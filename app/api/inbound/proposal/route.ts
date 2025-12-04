// app/api/inbound/proposal/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";
import { raw } from "@prisma/client/runtime/client";
// 💡 REQUIRED: Vercel Blob SDK for file uploads
// You need to run: npm install @vercel/blob
// import { put } from '@vercel/blob';

// Strict UUID regex remains the same
const UUID_V4_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// --- Interface matching the Resend 'email.received' payload structure ---
interface ResendWebhookPayload {
  data: {
    from: string;
    text: string; // The email body text
    attachments: {
      filename: string;
      content: string; // Base64 encoded file content
      mime_type: string;
    }[];
  };
}

// --- Function to extract required data ---
function extractRFPandVendor(
  rawEmail: string,
  resendFrom: string
): { rfpId: string | null; vendorEmail: string } {
  const match = rawEmail.match(
    new RegExp(`RFP-ID:\\s*(${UUID_V4_REGEX.source})`, "i")
  );
  let rfpId = match ? match[1] : null;

  if (rfpId) {
    rfpId = rfpId.trim();
  }

  // Regex to extract the pure email address from the 'from' header: "Name" <email@example.com>
  const emailMatch = resendFrom.match(/<([^>]+)>/) || [null, resendFrom];
  const vendorEmail = emailMatch[1] || resendFrom;

  return { rfpId, vendorEmail: vendorEmail.trim() };
}

// --- Main Webhook Handler ---
export async function POST(req: NextRequest) {
  // Stores metadata including the Vercel Blob URL after upload
  let attachmentsMetadata: {
    filename: string;
    mimeType: string;
    url: string;
  }[] = [];

  try {
    // 🛑 FIX: Use req.json() to parse the incoming JSON payload from Resend
    const resendPayload: ResendWebhookPayload = await req.json();
    console.log("Received Resend Webhook Payload:", resendPayload);

    // 🛑 FIX: Extract data from the nested JSON structure
    const rawEmailContent = resendPayload.data.text?.trim() || "";
    const vendorEmailFromHeader = resendPayload.data.from?.trim() || "";

    if (!rawEmailContent || !vendorEmailFromHeader) {
      console.log(rawEmailContent, vendorEmailFromHeader);
      return NextResponse.json(
        {
          error: "Missing required webhook payload fields (text/from).",
        },
        { status: 400 }
      );
    }

    // --- ATTACHMENT UPLOAD & PROCESSING ---
    const attachmentPromises: Promise<void>[] = [];

    for (const attachment of resendPayload.data.attachments) {
      attachmentPromises.push(
        (async () => {
          const filePath = `proposals/${crypto.randomUUID()}-${
            attachment.filename
          }`;

          // 💡 VERCEL BLOB LOGIC HERE:
          // const fileBuffer = Buffer.from(attachment.content, 'base64');

          // const blob = await put(filePath, fileBuffer, {
          //     access: 'public',
          //     contentType: attachment.mime_type
          // });

          // Placeholder for local testing:
          const blob = { url: `https://placeholder.com/${filePath}` };

          attachmentsMetadata.push({
            filename: attachment.filename,
            mimeType: attachment.mime_type,
            url: blob.url,
          });
        })()
      );
    }

    await Promise.all(attachmentPromises);
    // --------------------------------------------------------------------------

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
      select: { id: true, email: true, name: true },
    });

    if (!vendor) {
      console.warn(
        `Vendor with email ${vendorEmail} not found. Ignoring proposal.`
      );
      return NextResponse.json(
        { error: `Vendor with email ${vendorEmail} not found in database.` },
        { status: 404 }
      );
    }

    // 3. Define the AI System Prompt (placeholder for schema)
    const systemPrompt = `You are a proposal parsing engine. Your task is to extract key pricing, terms, and technical information from the vendor's email into a structured format. The schema shape is: ${JSON.stringify(
      StructuredProposalZod.shape
    )}. Focus on the raw email content for data extraction.`;

    // 4. Call Groq for structured proposal parsing
    const structuredProposal = await getStructuredGroqOutput(
      systemPrompt,
      rawEmailContent,
      StructuredProposalZod
    );

    const { pricingDetails, keyTermsSummary, completenessScore } =
      structuredProposal as any;

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
          attachments: attachmentsMetadata as any,
        },
      }),

      // Operation 2: Update the RFPVendor Join Table Status to 'responded'
      prisma.rFPVendor.update({
        where: { rfpId_vendorId: { rfpId: rfpId, vendorId: vendor.id } },
        data: { status: "responded" },
      }),
    ]);

    // 🛑 CRITICAL: After the transaction, trigger the OCR process
    if (attachmentsMetadata.length > 0) {
      console.log(
        `Triggering attachment processing for Proposal: ${newProposal.id}`
      );
      // This assumes the BASE_URL is correctly set up for your local tunnel/deployment
      fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/proposals/${newProposal.id}/process-attachments`,
        {
          method: "POST",
        }
      ).catch((e) => console.error("Failed to trigger OCR process:", e));
    }

    return NextResponse.json(
      {
        status: "ok",
        message: "Proposal successfully processed and saved. OCR triggered.",
        proposalId: newProposal.id,
        attachmentsSaved: attachmentsMetadata.map((a) => a.filename),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Critical Proposal Parsing Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred during proposal processing.";

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
