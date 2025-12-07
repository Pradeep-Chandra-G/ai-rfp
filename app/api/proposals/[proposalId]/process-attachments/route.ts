// app/api/proposals/[proposalId]/process-attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStructuredGroqOutput } from "@/lib/groq";
import { z } from "zod";
import Groq from "groq-sdk";
// 💡 Use unpdf for serverless-friendly PDF text extraction
import { extractText, getDocumentProxy } from "unpdf"; // NEW IMPORT

interface RouteContext {
  params: { proposalId: string };
}

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
  
  totalAmount: z
    .number()
    .nullable()
    .describe("Total quoted amount if found"),
  
  deliveryTimeline: z
    .string()
    .nullable()
    .describe("Delivery or timeline information"),
  
  warrantyInfo: z
    .string()
    .nullable()
    .describe("Warranty or guarantee information"),
  
  paymentTerms: z
    .string()
    .nullable()
    .describe("Payment terms if specified"),
  
  additionalNotes: z
    .string()
    .describe("Any other important information extracted from the document"),
});

type OCRExtraction = z.infer<typeof OCRExtractionZod>;

/**
 * Performs OCR on image/PDF attachments using Groq's vision model and unpdf
 */
async function performOCR(attachmentUrl: string, mimeType: string): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const response = await fetch(attachmentUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // 1. Image Processing (using Groq Vision)
    if (mimeType.startsWith("image/")) {
      const base64Image = Buffer.from(arrayBuffer).toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.2-90b-vision-preview",
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
    }

    // 2. PDF Processing (using unpdf)
    if (mimeType === "application/pdf") {
      try {
        const pdfUint8Array = new Uint8Array(arrayBuffer);
        
        // 1. Load the PDF document proxy
        const pdf = await getDocumentProxy(pdfUint8Array);

        // 2. Extract all text, merging all pages into a single string
        const { text } = await extractText(pdf, { mergePages: true }) as { text: string }; 
        
        // Use Groq to structure the extracted text
        const structuringCompletion = await groq.chat.completions.create({
          model: "llama-3.1-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Extract and organize pricing, terms, and delivery information from this PDF text.",
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
        console.error("PDF parsing error with unpdf:", pdfError);
        // Fallback for failed PDF parsing
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
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await context.params;
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

    if (!attachments || attachments.length === 0) {
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
        console.error(
          `Failed to OCR ${attachment.filename}:`,
          error
        );
        ocrResults.push({
          filename: attachment.filename,
          extractedText: `Error processing file: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    // 3. Combine all OCR results
    const combinedOCRText = ocrResults
      .map((r) => `--- File: ${r.filename} ---\n${r.extractedText}`)
      .join("\n\n");

    // 4. Use AI to extract structured data from OCR text
    const systemPrompt = `You are an expert at extracting structured pricing and terms data from OCR'd vendor proposal documents. 

The original RFP requirements were:
${JSON.stringify(proposal.rfp.requirements, null, 2)}

The vendor's email proposal was:
${proposal.rawEmail.substring(0, 1000)}

Now you have additional information from OCR'd attachments. Extract any pricing, delivery, warranty, or terms information and structure it according to this schema:
${JSON.stringify(OCRExtractionZod.shape)}`;

    const structuredOCRData = await getStructuredGroqOutput(
      systemPrompt,
      combinedOCRText,
      OCRExtractionZod
    ) as OCRExtraction;

    // 5. Merge OCR data with existing proposal data
    const currentPricing = (proposal.pricing as any) || {};
    const currentTerms = (proposal.terms as any) || {};

    const updatedPricing = {
      ...currentPricing,
      ocrDetectedItems: structuredOCRData.detectedPricing,
      ocrTotalAmount: structuredOCRData.totalAmount,
    };

    const updatedTerms = {
      ...currentTerms,
      ocrDeliveryTimeline: structuredOCRData.deliveryTimeline,
      ocrWarrantyInfo: structuredOCRData.warrantyInfo,
      ocrPaymentTerms: structuredOCRData.paymentTerms,
      ocrAdditionalNotes: structuredOCRData.additionalNotes,
    };

    // 6. Update the proposal with enriched data
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        pricing: updatedPricing,
        terms: updatedTerms,
        // Store raw OCR results for reference
        rawEmail: `${proposal.rawEmail}\n\n--- OCR EXTRACTED DATA ---\n${combinedOCRText}`,
      },
    });

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