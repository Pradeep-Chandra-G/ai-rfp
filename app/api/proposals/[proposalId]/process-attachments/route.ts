// app/api/proposals/[proposalId]/process-attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStructuredGroqOutput } from "@/lib/groq";
import { z } from "zod";
import Groq from "groq-sdk";
import { extractText, getDocumentProxy } from "unpdf";
import { revalidatePath } from "next/cache";

// Schema for extracting structured data from OCR'd documents
const OCRExtractionZod = z.object({
  detectedPricing: z
    .array(
      z.object({
        item: z.string(),
        unitPrice: z.number().nullable(),
        quantity: z.number().int().nullable(),
        totalPrice: z.number().nullable(),
      })
    )
    .describe("Line items found in the document"),

  totalAmount: z.number().nullable().describe("Total quoted amount if found"),

  deliveryTimeline: z
    .string()
    .nullable()
    .describe("Delivery or timeline information"),

  warrantyInfo: z
    .string()
    .nullable()
    .describe("Warranty or guarantee information"),

  paymentTerms: z.string().nullable().describe("Payment terms if specified"),

  additionalNotes: z
    .string()
    .describe("Any other important information extracted from the document"),
});

type OCRExtraction = z.infer<typeof OCRExtractionZod>;

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(`[RETRY] Attempt ${i + 1} failed. Retrying in 500ms...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Retry limit reached.");
}

/**
 * Calculates a score (0-100) based on how close the OCR-extracted price is to the initial email-extracted price.
 */
function calculatePriceConfidence(
  emailPrice: number | null,
  ocrPrice: number | null
): number {
  // If either price is missing or the email price is zero, we cannot compare accurately, so return a neutral score.
  if (emailPrice === null || ocrPrice === null || emailPrice === 0) {
    return 50;
  } // Calculate the percentage difference

  const difference = Math.abs(emailPrice - ocrPrice); // Use an exponential decay model for severe penalization of large differences.

  const k = 5; // Sensitivity factor (adjust this for desired penalty steepness)
  const ratio = difference / emailPrice;
  const score = 100 * Math.exp(-k * ratio); // Clamp and round to ensure a clean number is returned

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Performs OCR on image/PDF attachments using Groq's vision model and unpdf
 */
async function performOCR(
  attachmentUrl: string,
  mimeType: string
): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const response = await fetch(attachmentUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer(); // 1. Image Processing (using Groq Vision)

    if (mimeType.startsWith("image/")) {
      const base64Image = Buffer.from(arrayBuffer).toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are an expert at reading and extracting text from vendor quotation documents. Extract ALL text from this image with extreme accuracy. Include pricing, terms, and delivery info. Format as structured plain text.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      return completion.choices[0]?.message?.content || "";
    } // 2. PDF Processing (using unpdf)

    if (mimeType === "application/pdf") {
      try {
        const pdfUint8Array = new Uint8Array(arrayBuffer); // FIX: Use retry wrapper for PDF extraction

        const { text } = await retryOperation(async () => {
          // 1. Load the PDF document proxy
          const pdf = await getDocumentProxy(pdfUint8Array); // 2. Extract all text, merging all pages into a single string

          return (await extractText(pdf, { mergePages: true })) as {
            text: string;
          };
        }, 2); // Retry up to 2 times (3 total attempts) // Use Groq to structure the extracted text

        const structuringCompletion = await groq.chat.completions.create({
          model: "meta-llama/llama-4-maverick-17b-128e-instruct",
          messages: [
            {
              role: "system",
              content:
                "Extract and organize pricing, terms, and delivery information from this PDF text.",
            },
            {
              role: "user",
              content: text, // Pass the extracted text
            },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        });

        return structuringCompletion.choices[0]?.message?.content || text;
      } catch (pdfError) {
        console.error("PDF parsing error with unpdf:", pdfError); // Fallback for failed PDF parsing
        return "PDF text extraction failed. Document may be scanned or malformed.";
      }
    }

    return "";
  } catch (error) {
    console.error("OCR/Attachment Fetch Error:", error);
    throw error;
  }
}

/**
 * Main handler for processing attachments
 */
export async function POST(
  req: NextRequest,
  // Using the union type that covers the compiler's internal promise wrapper
  context:
    | { params: { proposalId: string } }
    | { params: Promise<{ proposalId: string }> }
) {
  try {
    // Await the params object to safely handle the promise wrapper check
    const resolvedParams = await (context.params as
      | Promise<{ proposalId: string }>
      | { proposalId: string });
    const proposalId = resolvedParams.proposalId;

    if (!proposalId) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch the proposal with attachments
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        vendor: true,
        rfp: true,
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const attachments = proposal.attachments as {
      filename: string;
      url: string;
      mimeType: string;
    }[];

    // CRITICAL FIX: If NO attachments, skip all processing and DB update.
    if (!attachments || attachments.length === 0) {
      console.log(
        `Skipping OCR process for proposal ${proposalId}: No attachments found.`
      );
      // --- LOGGING CHECKPOINT 1 ---
      console.log(
        `[CHECKPOINT 1 - NO ATTACHMENT]: Price in DB: ${JSON.stringify(
          proposal.pricing
        )}`
      );
      return NextResponse.json(
        { message: "No attachments to process" },
        { status: 200 }
      );
    }

    // 2. Process each attachment with OCR/Text Extraction

    const ocrResults: { filename: string; extractedText: string }[] = [];

    for (const attachment of attachments) {
      console.log(`Processing attachment: ${attachment.filename}`);

      try {
        const extractedText = await performOCR(
          attachment.url,
          attachment.mimeType
        );

        ocrResults.push({
          filename: attachment.filename,
          extractedText,
        });
      } catch (error) {
        console.error(`Failed to OCR ${attachment.filename}:`, error);
        ocrResults.push({
          filename: attachment.filename,
          extractedText: `Error processing file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    } // 3. Combine all OCR results

    const combinedOCRText = ocrResults
      .map((r) => `--- File: ${r.filename} ---\n${r.extractedText}`)
      .join("\n\n"); // 4. Use AI to extract structured data from OCR text

    const systemPrompt = `You are an expert at extracting structured pricing and terms data from OCR'd vendor proposal documents. 
    
The original RFP requirements were:
${JSON.stringify(proposal.rfp.requirements, null, 2)}

The vendor's email proposal was:
${proposal.rawEmail.substring(0, 1000)}

Now you have additional information from OCR'd attachments. Extract any pricing, delivery, warranty, or terms information and structure it according to this schema:
${JSON.stringify(OCRExtractionZod.shape)}`;

    const structuredOCRData = (await getStructuredGroqOutput(
      systemPrompt,
      combinedOCRText,
      OCRExtractionZod
    )) as OCRExtraction;

    // --- LOGGING CHECKPOINT 2 ---
    console.log(
      `[CHECKPOINT 2 - OCR EXTRACT]: OCR Total Amount: ${structuredOCRData.totalAmount}`
    );

    // 5. Merge OCR data with existing proposal data
    const currentPricing = (proposal.pricing as any) || {};
    const currentTerms = (proposal.terms as any) || {};

    // CRITICAL FIX: Read totalPrice reliably from the new structure.
    // If totalPrice is missing from the initial email parse, this will be null.
    const emailTotalPrice = currentPricing.totalPrice
      ? Number(currentPricing.totalPrice)
      : null;
    const ocrTotalAmount = structuredOCRData.totalAmount
      ? Number(structuredOCRData.totalAmount)
      : null;

    // --- LOGGING CHECKPOINT 3 ---
    console.log(
      `[CHECKPOINT 3 - CALCULATE]: Email Price (Total): ${emailTotalPrice}`
    );
    console.log(
      `[CHECKPOINT 3 - CALCULATE]: OCR Price (Total): ${ocrTotalAmount}`
    );

    // CRITICAL FIX: Calculate Confidence Score and ensure it's saved as a number.
    const confidenceScore = calculatePriceConfidence(
      emailTotalPrice,
      ocrTotalAmount
    );

    // --- LOGGING CHECKPOINT 4 ---
    console.log(
      `[CHECKPOINT 4 - RESULT]: Calculated Confidence Score: ${confidenceScore}`
    );

    const updatedPricing = {
      ...currentPricing,
      ocrDetectedItems: structuredOCRData.detectedPricing,
      ocrTotalAmount: ocrTotalAmount,
      // Ensures the value is saved as a clean number (not null, undefined, or string)
      ocrConfidenceScore: Number(confidenceScore),
    };

    const updatedTerms = {
      ...currentTerms,
      ocrDeliveryTimeline: structuredOCRData.deliveryTimeline,
      ocrWarrantyInfo: structuredOCRData.warrantyInfo,
      ocrPaymentTerms: structuredOCRData.paymentTerms,
      ocrAdditionalNotes: structuredOCRData.additionalNotes,
    };

    const originalEmailContent = proposal.rawEmail
      .split("--- OCR EXTRACTED DATA ---")[0]
      .trim();

    // 6. Update the proposal with enriched data
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        pricing: updatedPricing,
        terms: updatedTerms,
        rawEmail: `${originalEmailContent}\n\n--- OCR EXTRACTED DATA ---\n${combinedOCRText}`,
      },
    });

    // 7. Force UI Refresh

    revalidatePath(`/proposal/${proposalId}`);

    return NextResponse.json(
      {
        status: "ok",
        message: "Attachments processed successfully",
        ocrResults: ocrResults.map((r) => ({
          filename: r.filename,
          textLength: r.extractedText.length,
        })),
        structuredData: structuredOCRData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Attachment processing error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to process attachments",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
