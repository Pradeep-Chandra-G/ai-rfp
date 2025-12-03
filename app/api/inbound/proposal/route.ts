// app/api/inbound/proposal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";

// Function to extract required data
function extractRFPandVendor(
  rawEmail: string,
  resendFrom: string // The vendor's email address passed by the webhook
): {
  rfpId: string | null;
  vendorEmail: string;
} {
  // 1. Extract RFP ID: Assume the RPF-ID is embedded in the body.
  const rfpMatch = rawEmail.match(/RFP-ID: (\S+)/i); // Case-insensitive match

  // 2. Extract Vendor Email: Use the 'from' header provided by Resend
  return {
    rfpId: rfpMatch ? rfpMatch[1] : null,
    vendorEmail: resendFrom,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 💡 FIX 1: Read the body as formData for Resend webhook payload
    const formData = await req.formData();

    // The main email text is typically found under the 'text' key
    const rawEmailContent = formData.get("text")?.toString() || "";

    // The vendor's email is found under the 'from' key in the webhook payload
    const vendorEmailFromHeader = formData.get("from")?.toString() || "";

    if (!rawEmailContent || !vendorEmailFromHeader) {
      return NextResponse.json(
        {
          error:
            "Missing required email content (text/from) in webhook payload.",
        },
        { status: 400 }
      );
    }

    // 1. Extract context from the email (RFP ID, Vendor)
    const { rfpId, vendorEmail } = extractRFPandVendor(
      rawEmailContent,
      vendorEmailFromHeader
    );

    if (!rfpId) {
      return NextResponse.json(
        { error: "RFP ID not found in the email body (RFP-ID: [id])." },
        { status: 400 }
      );
    }

    // Find the vendor in the database
    const vendor = await prisma.vendor.findUnique({
      where: { email: vendorEmail },
    });
    if (!vendor) {
      console.warn(`Vendor with email ${vendorEmail} not found in database.`);
      return NextResponse.json(
        { error: `Vendor with email ${vendorEmail} not found.` },
        { status: 404 }
      );
    }

    // 2. Define the AI System Prompt
    const systemPrompt = `You are a proposal parsing engine. Your task is to analyze the vendor's email response (proposal) and extract all pricing, terms, and conditions into a clean JSON object that strictly adheres to the provided Zod schema. The schema is: ${JSON.stringify(
      StructuredProposalZod.shape
    )}.
    - Determine the Total Price, currency, and detailed breakdown.
    - Provide a completeness score based on how well the proposal matches the original RFP requirements implied by the context (0-100).
    - Summarize the key terms in 2-3 sentences.`;

    // 3. Call Groq for structured proposal parsing
    const structuredProposal = await getStructuredGroqOutput(
      systemPrompt,
      rawEmailContent,
      StructuredProposalZod
    );

    // 4. Save the new Proposal to the database
    const newProposal = await prisma.proposal.create({
      data: {
        rfpId: rfpId,
        vendorId: vendor.id,
        rawEmail: rawEmailContent,
        pricing: structuredProposal.pricingDetails as any,
        terms: { summary: structuredProposal.keyTermsSummary } as any,
        aiScore: structuredProposal.completenessScore,
        aiSummary: structuredProposal.keyTermsSummary,
        rfpVendor: {
          upsert: {
            where: { rfpId_vendorId: { rfpId: rfpId, vendorId: vendor.id } },
            update: { status: "responded" },
            create: { rfpId: rfpId, vendorId: vendor.id, status: "responded" },
          },
        },
      },
    });

    return NextResponse.json(
      {
        status: "ok",
        message: "Proposal parsed and saved.",
        proposal: newProposal,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Proposal Parsing Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to parse and save proposal.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
