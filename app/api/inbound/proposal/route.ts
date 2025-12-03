// app/api/inbound/proposal/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";

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
    
    return { rfpId, vendorEmail: resendFrom.trim() };
}

// --- Main Webhook Handler ---
export async function POST(req: NextRequest) {
    let attachments: { filename: string; mimeType: string }[] = [];
    
    try {
        const formData = await req.formData();
        
        const rawEmailContent = (formData.get("text") as string)?.trim() || "";
        const vendorEmailFromHeader = (formData.get("from") as string)?.trim() || "";

        // --- ATTACHMENT PROCESSING ---
        const attachmentFileNames: string[] = [];

        // Iterate over all entries in the multipart form data
        for (const [key, value] of formData.entries()) {
            // Check if the entry is a File object (an attachment)
            if (value instanceof File && key.startsWith('attachment')) {
                
                // IMPORTANT: In a production app, you would upload the file here 
                // (e.g., to S3, Vercel Blob) and save the URL.
                // For now, we only extract and save the metadata (filename and type).
                
                attachmentFileNames.push(value.name);
                attachments.push({
                    filename: value.name,
                    mimeType: value.type,
                });
            }
        }
        // -----------------------------

        if (!rawEmailContent || !vendorEmailFromHeader) {
            return NextResponse.json(
                {
                    error: "Missing required webhook payload fields (text/from).",
                },
                { status: 400 }
            );
        }

        // 1. Extract context from the email (RFP ID, Vendor)
        const { rfpId, vendorEmail } = extractRFPandVendor(
            rawEmailContent,
            vendorEmailFromHeader
        );

        if (!rfpId || !UUID_V4_REGEX.test(rfpId)) {
            return NextResponse.json(
                { error: "Invalid or missing RFP ID (must be UUID format)." },
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

        // 3. Define the AI System Prompt (unchanged)
        const systemPrompt = `You are a proposal parsing engine. ... The schema shape is: ${JSON.stringify(StructuredProposalZod.shape)}. ...`;

        // 4. Call Groq for structured proposal parsing (unchanged)
        const structuredProposal = await getStructuredGroqOutput(
            systemPrompt,
            rawEmailContent,
            StructuredProposalZod
        );
        
        const { 
            pricingDetails, 
            keyTermsSummary, 
            completenessScore 
        } = structuredProposal as any; 


        // 5. Save the new Proposal and update RFPVendor status atomically
        const [newProposal] = await prisma.$transaction([
            // Operation 1: Create the Proposal Record
            prisma.proposal.create({
                data: {
                    rfpId: rfpId,
                    vendorId: vendor.id,
                    rawEmail: rawEmailContent,
                    pricing: pricingDetails as any, 
                    terms: { summary: keyTermsSummary } as any, 
                    aiScore: completenessScore,
                    aiSummary: keyTermsSummary,
                    // 💡 NEW: Save the list of attachment metadata (filenames, types)
                    attachments: attachments as any, 
                },
            }),

            // Operation 2: Update the RFPVendor Join Table Status to 'responded'
            prisma.rFPVendor.update({
                where: { rfpId_vendorId: { rfpId: rfpId, vendorId: vendor.id } },
                data: { status: "responded" },
            }),
        ]);

        return NextResponse.json(
            {
                status: "ok",
                message: "Proposal successfully processed and saved.",
                proposalId: newProposal.id,
                attachmentsSaved: attachmentFileNames, // Confirm attachments were seen
            },
            { status: 201 }
        );
    } catch (error) {
        // ... error handling (unchanged) ...
        console.error("Critical Proposal Parsing Error:", error);
        
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during proposal processing.";

        return NextResponse.json(
            {
                status: "error",
                message: "Failed to parse and save proposal.",
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}