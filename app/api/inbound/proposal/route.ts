// app/api/inbound/proposal/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";

// Strict UUID regex to prevent capturing trailing punctuation (like '.') or whitespace
const UUID_V4_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// --- Function to extract required data (Simplified and safer) ---
function extractRFPandVendor(
    rawEmail: string,
    resendFrom: string
): { rfpId: string | null; vendorEmail: string } {
    // Look for "RFP-ID:" followed by the strict UUID pattern
    const match = rawEmail.match(new RegExp(`RFP-ID:\\s*(${UUID_V4_REGEX.source})`, 'i'));

    let rfpId = match ? match[1] : null;

    // Aggressively trim any residual whitespace from the extracted ID
    if (rfpId) {
        rfpId = rfpId.trim();
    }

    // Ensure the vendor email is clean
    const vendorEmail = resendFrom.trim();
    
    return { rfpId, vendorEmail };
}

// --- Main Webhook Handler ---
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // Use safe accessors with a fallback type for clarity
        const rawEmailContent = (formData.get("text") as string)?.trim() || "";
        const vendorEmailFromHeader = (formData.get("from") as string)?.trim() || "";

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
            select: { id: true, email: true, name: true } // Select only needed fields
        });

        if (!vendor) {
            console.warn(`Vendor with email ${vendorEmail} not found. Ignoring proposal.`);
            return NextResponse.json(
                { error: `Vendor with email ${vendorEmail} not found in database.` },
                { status: 404 }
            );
        }

        // 3. Define the AI System Prompt
        // NOTE: It is generally safer to define this prompt outside the handler 
        // or fetch it from a centralized config if possible.
        const systemPrompt = `You are a proposal parsing engine. Analyze the vendor's email proposal and extract pricing, terms, and conditions into a clean JSON object that strictly adheres to the provided Zod schema. The schema shape is: ${JSON.stringify(
            StructuredProposalZod.shape
        )}. Focus on accurately extracting all details, including completeness score (0-100) and a summary.`;

        // 4. Call Groq for structured proposal parsing
        const structuredProposal = await getStructuredGroqOutput(
            systemPrompt,
            rawEmailContent,
            StructuredProposalZod
        );
        
        // Ensure structuredProposal has the expected fields before saving
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
                    // Use clean object fields instead of just casting 'as any' 
                    pricing: pricingDetails as any, 
                    terms: { summary: keyTermsSummary } as any, 
                    aiScore: completenessScore,
                    aiSummary: keyTermsSummary,
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
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Critical Proposal Parsing Error:", error);
        
        // Return a 500 with sanitized details.
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