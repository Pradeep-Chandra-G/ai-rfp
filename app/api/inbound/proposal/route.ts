// app/api/inbound/proposal/route.ts - WITH VERCEL BLOB IMPLEMENTATION
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredProposalZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { uploadToBlob } from "@/lib/storage";

const resend = new Resend(process.env.RESEND_API_KEY);

const UUID_V4_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

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

  const emailMatch = resendFrom.match(/<([^>]+)>/) || [null, resendFrom];
  const vendorEmail = emailMatch[1] || resendFrom;

  return { rfpId, vendorEmail: vendorEmail.trim() };
}

export async function POST(req: NextRequest) {
  const attachmentsMetadata: {
    filename: string;
    mimeType: string;
    url: string;
  }[] = [];

  try {
    const webhookEvent: any = await req.json();

    if (webhookEvent.type !== "email.received") {
      return NextResponse.json(
        { message: "Ignoring non-received email event." },
        { status: 200 }
      );
    }

    // 1. Fetch full email content from Resend
    const { data: fullEmail, error: resendError } =
      await resend.emails.receiving.get(webhookEvent.data.email_id);

    if (resendError || !fullEmail) {
      console.error("Resend Receiving API Error:", resendError);
      throw new Error("Failed to fetch full email content from Resend.");
    }

    const rawEmailContent =
      fullEmail.text?.trim() || fullEmail.subject?.trim() || "";
    const vendorEmailFromHeader = fullEmail.from?.trim() || "";

    if (!vendorEmailFromHeader) {
      return NextResponse.json(
        { error: "Missing 'from' header." },
        { status: 400 }
      );
    }

    // 2. ATTACHMENT UPLOAD TO VERCEL BLOB
    const attachmentPromises: Promise<void>[] = [];

    if (fullEmail.attachments && fullEmail.attachments.length > 0) {
      console.log(
        `📎 Uploading ${fullEmail.attachments.length} attachment(s) to Vercel Blob...`
      );

      for (const attachment of fullEmail.attachments) {
        attachmentPromises.push(
          (async () => {
            try {
              // 1. Use Resend SDK to get attachment details (including download_url)
              const { data: attachmentDetails, error: attachError } =
                await resend.emails.receiving.attachments.get({
                  emailId: fullEmail.id,
                  id: attachment.id,
                });

              if (
                attachError ||
                !attachmentDetails ||
                !attachmentDetails.download_url
              ) {
                console.error(
                  `Resend Attachment Get Error for ${attachment.filename}:`,
                  attachError
                );
                throw new Error(
                  `Failed to get attachment download details for ${attachment.filename}. Error: ${attachError?.message}`
                );
              }

              // 2. Fetch the binary data using the provided download URL
              const fetchResponse = await fetch(attachmentDetails.download_url);
              if (!fetchResponse.ok) {
                throw new Error(
                  `Failed to download attachment from Resend CDN: ${fetchResponse.statusText}`
                );
              }

              // 3. Convert ArrayBuffer to Buffer for Vercel Blob upload
              const fileBuffer = Buffer.from(await fetchResponse.arrayBuffer());

              const blobUrl = await uploadToBlob(
                attachment.filename,
                fileBuffer,
                attachment.content_type,
                "proposals"
              );

              attachmentsMetadata.push({
                filename: attachment.filename,
                mimeType: attachment.content_type,
                url: blobUrl,
              });
            } catch (uploadError) {
              console.error(
                `❌ Failed to upload ${attachment.filename}:`,
                uploadError
              );
            }
          })()
        );
      }

      await Promise.all(attachmentPromises);
    }

    // 3. Extract RFP ID and Vendor
    const { rfpId, vendorEmail } = extractRFPandVendor(
      rawEmailContent,
      vendorEmailFromHeader
    );

    if (!rfpId || !UUID_V4_REGEX.test(rfpId)) {
      return NextResponse.json(
        { error: "RFP-ID could not be extracted from the email content." },
        { status: 400 }
      );
    }

    // 4. Find Vendor
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

    // 5. AI Parsing of Email Body
    const systemPrompt = `You are a proposal parsing engine. Extract pricing, delivery timelines, warranty terms, and completeness information from vendor proposals. 

Your output MUST strictly conform to this schema:
${JSON.stringify(StructuredProposalZod.shape)}

Analyze the proposal thoroughly and provide realistic completeness scores based on how well the vendor addressed all requirements.`;

    const structuredProposal = await getStructuredGroqOutput(
      systemPrompt,
      rawEmailContent,
      StructuredProposalZod
    );

    const {
      totalPrice,
      currency,
      deliveryEstimateDays,
      warrantyPeriod,
      pricingDetails,
      completenessScore,
      keyTermsSummary,
    } = structuredProposal as any;

    console.log(
      `[CHECKPOINT 5 - INBOUND SAVE]: Email AI Extracted Price: ${totalPrice}`
    );

    // 6. Save Proposal to Database
    const [newProposal] = await prisma.$transaction([
      prisma.proposal.create({
        data: {
          rfpId: rfpId,
          vendorId: vendor.id,
          rawEmail: rawEmailContent,
          pricing: {
            totalPrice: totalPrice,
            currency: currency,
            deliveryEstimateDays: deliveryEstimateDays,
            warrantyPeriod: warrantyPeriod,
            pricingDetails: pricingDetails,
          } as any,
          terms: {
            summary: keyTermsSummary,
            deliveryEstimateDays: deliveryEstimateDays,
            warrantyPeriod: warrantyPeriod,
          } as any,
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

    // 7. Update RFP Status
    await prisma.rFP.update({
      where: { id: rfpId, status: { not: "completed" } },
      data: { status: "responded" },
    });

    // 8. Trigger OCR Processing Asynchronously
    if (attachmentsMetadata.length > 0) {
      console.log(
        `🔍 Triggering OCR processing for ${attachmentsMetadata.length} attachment(s)...`
      );

      fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/proposals/${newProposal.id}/process-attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      ).catch((e) => console.error("Failed to trigger OCR process:", e));
    }

    revalidatePath("/");

    return NextResponse.json(
      {
        status: "ok",
        message: "Proposal successfully processed and saved. OCR triggered.",
        proposalId: newProposal.id,
        attachmentsUploaded: attachmentsMetadata.length,
        attachmentUrls: attachmentsMetadata.map((a) => a.url),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Critical Proposal Processing Error:", error);

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
