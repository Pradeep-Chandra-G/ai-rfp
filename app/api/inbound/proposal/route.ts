// app/api/inbound/proposal/route.ts - FINAL CORRECTED VERSION

import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
// import { put } from '@vercel/blob'; // Required if using Vercel Blob

const resend = new Resend(process.env.RESEND_API_KEY);

// Strict UUID regex remains the same
const UUID_V4_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// --- Function to extract required data ---
function extractRFPandVendor(
    rawEmail: string,
    resendFrom: string
): { rfpId: string | null; vendorEmail: string } {
    const match = rawEmail.match(new RegExp(`RFP-ID:\\s*(${UUID_V4_REGEX.source})`, 'i'));
    let rfpId = match ? match[1] : null;

    if (rfpId) {
        rfpId = rfpId.trim();
    }
    
    // Regex to extract the pure email address from the 'from' header
    const emailMatch = resendFrom.match(/<([^>]+)>/) || [null, resendFrom];
    const vendorEmail = emailMatch[1] || resendFrom;
    
    return { rfpId, vendorEmail: vendorEmail.trim() };
}

// --- Main Webhook Handler ---
export async function POST(req: NextRequest) {
    let attachmentsMetadata: { filename: string; mimeType: string; url: string }[] = [];
    
    try {
        const webhookEvent: any = await req.json(); // Use 'any' for the webhook structure
        
        if (webhookEvent.type !== 'email.received') {
            return NextResponse.json({ message: "Ignoring non-received email event." }, { status: 200 });
        }

        // 🛑 STEP 1: CALL THE RESEND RECEIVING API TO GET THE FULL EMAIL CONTENT
        const { data: fullEmail, error: resendError } = await resend
            .emails
            .receiving
            .get(webhookEvent.data.email_id);

        if (resendError || !fullEmail) {
             console.error("Resend Receiving API Error:", resendError);
             throw new Error("Failed to fetch full email content from Resend.");
        }

        // 🛑 STEP 2: EXTRACT THE CONTENT FROM THE FETCHED EMAIL OBJECT
        const rawEmailContent = fullEmail.text?.trim() || fullEmail.subject?.trim() || "";
        const vendorEmailFromHeader = fullEmail.from?.trim() || "";
        
        // --- BASIC VALIDATION ---
        if (!vendorEmailFromHeader) {
            return NextResponse.json({ error: "Missing 'from' header." }, { status: 400 });
        }

        // --- ATTACHMENT UPLOAD & PROCESSING ---
        // fullEmail.attachments contains the actual attachment data for Vercel Blob
        const attachmentPromises: Promise<void>[] = [];

        for (const attachment of fullEmail.attachments || []) {
            
            attachmentPromises.push((async () => {
                const filePath = `proposals/${crypto.randomUUID()}-${attachment.filename}`;
                
                // 💡 Implement Vercel Blob logic here:
                // const fileBuffer = Buffer.from(attachment.content as string, 'base64');
                // const blob = await put(filePath, fileBuffer, { ... });
                
                // Placeholder for local testing:
                const blob = { url: `https://placeholder.com/${filePath}` };
                
                attachmentsMetadata.push({
                    filename: attachment.filename,
                    mimeType: attachment.mime_type as string, // Ensure type casting is safe
                    url: blob.url,
                });
            })());
        }
        
        await Promise.all(attachmentPromises);
        // --------------------------------------------------------------------------

        // 1. Extract context (RFP ID, Vendor)
        const { rfpId, vendorEmail } = extractRFPandVendor(
            rawEmailContent,
            vendorEmailFromHeader
        );

        if (!rfpId || !UUID_V4_REGEX.test(rfpId)) {
            // This is the correct error to return if the RFP-ID is missing/invalid
            return NextResponse.json(
                { error: "RFP-ID could not be extracted from the email content." },
                { status: 400 }
            );
        }

        // 2. Find Vendor and Validate Existence
        const vendor = await prisma.vendor.findUnique({
            where: { email: vendorEmail },
            select: { id: true, email: true, name: true }
        });

        if (!vendor) {
            console.warn(`Vendor with email ${vendorEmail} not found. Ignoring proposal.`);
            return NextResponse.json(
                { error: `Vendor with email ${vendorEmail} not found in database.` },
                { status: 404 }
            );
        }

        // 3. Define the AI System Prompt and 4. Call Groq
        const systemPrompt = `You are a proposal parsing engine. ... ${JSON.stringify(StructuredProposalZod.shape)}. ...`;

        const structuredProposal = await getStructuredGroqOutput(
            systemPrompt,
            rawEmailContent,
            StructuredProposalZod
        );
        
        const { pricingDetails, keyTermsSummary, completenessScore } = structuredProposal as any; 


        // 5. Save the new Proposal and update RFPVendor status
        const [newProposal] = await prisma.$transaction([
            prisma.proposal.create({
                data: {
                    rfpId: rfpId,
                    vendorId: vendor.id,
                    rawEmail: rawEmailContent,
                    pricing: pricingDetails as any, 
                    terms: { summary: keyTermsSummary } as any, 
                    aiScore: completenessScore,
                    aiSummary: keyTermsSummary,
                    attachments: attachmentsMetadata as any, 
                },
            }),
            prisma.rFPVendor.update({
                where: { rfpId_vendorId: { rfpId: rfpId, vendorId: vendor.id } },
                data: { status: "responded" },
            }),
        ]);

        // Trigger OCR process for attachments (Asynchronous)
        if (attachmentsMetadata.length > 0) {
            fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/proposals/${newProposal.id}/process-attachments`, {
                method: 'POST',
            }).catch(e => console.error("Failed to trigger OCR process:", e));
        }

        return NextResponse.json(
            { status: "ok", message: "Proposal successfully processed and saved. OCR triggered.", proposalId: newProposal.id },
            { status: 201 }
        );
    } catch (error) {
        // ... (Error handling remains the same) ...
        console.error("Critical Proposal Processing Error:", error);
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during proposal processing.";

        return NextResponse.json(
            { status: "error", message: "Failed to parse and save proposal.", details: errorMessage },
            { status: 500 }
        );
    }
}