// app/api/rfp/[rfpId]/compare/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { prisma } from "@/lib/db";
import { z } from "zod";

interface RouteContext {
  params:
    | {
        rfpId: string;
      }
    | Promise<{
        rfpId: string;
      }>; // Allow params to be the Promise wrapper
}

// Zod Schema for the final AI Recommendation Output
const RecommendationZod = z.object({
  recommendation: z.string().describe("The name of the recommended vendor."),
  rationale: z
    .string()
    .describe(
      "A detailed, 3-5 sentence explanation of why this vendor is recommended, focusing on normalized score, price/budget, and data confidence."
    ),
  comparisonSummary: z
    .array(
      z.object({
        vendorName: z.string(),
        aiScore: z
          .number()
          .int()
          .min(0)
          .max(100)
          .describe("The initial completeness score."),
        totalPrice: z
          .number()
          .nullable()
          .describe("The final quoted price used for comparison."),
        deliveryEstimate: z
          .number()
          .int()
          .nullable()
          .describe("Delivery estimate in days (normalized)."),
        priceConfidence: z
          .number()
          .int()
          .min(0)
          .max(100)
          .describe("Confidence in the accuracy of the totalPrice (0-100)."),
        keyTakeaway: z
          .string()
          .describe("One sentence on the biggest pro or con of this proposal."),
      })
    )
    .describe("A table summarizing the key metrics of all proposals."),
  actionItems: z
    .array(z.string())
    .describe(
      "A list of 2-3 negotiation points or next steps for the recommended vendor."
    ),
});

export type Recommendation = z.infer<typeof RecommendationZod>;

// NEW Helper: Simplistic function to convert a common time string to days
function normalizeDeliveryToDays(deliveryString: string | null): number | null {
  if (!deliveryString) return null;
  const lower = deliveryString.toLowerCase();

  // Check for "XX days"
  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1]);

  // Check for "XX weeks"
  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1]) * 7;

  // Check for "XX months"
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1]) * 30; // Approximation

  return null;
}

// Define the expected Context type for clarity
// export interface Context {
//   params: {
//     rfpId: string;
//   };
// }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await (context.params as Promise<{ rfpId: string }>);
    const rfpId = resolvedParams.rfpId;

    const url = new URL(req.url);
    const pathnameParts = url.pathname.split("/");

    // Robustly retrieve rfpId if context.params is not fully resolved
    let fallbackRfpId: string | undefined;
    const compareIndex = pathnameParts.lastIndexOf("compare");
    if (compareIndex > 0) {
      fallbackRfpId = pathnameParts[compareIndex - 1];
    }
    const finalRfpId = rfpId || fallbackRfpId;

    console.log("Comparing proposals for RFP ID:", finalRfpId);

    if (!finalRfpId) {
      console.error("Failed to extract valid RFP ID.");
      return NextResponse.json(
        { error: "RFP ID is missing or invalid." },
        { status: 400 }
      );
    }

    // 1. Fetch the RFP and all associated Proposals
    const rfp = await prisma.rFP.findUnique({
      where: { id: rfpId },
      include: {
        proposals: {
          include: {
            vendor: true, // Include vendor details for naming
          },
        },
      },
    });

    if (!rfp) {
      return NextResponse.json({ error: "RFP not found" }, { status: 404 });
    }
    if (rfp.proposals.length === 0) {
      return NextResponse.json(
        { error: "No proposals received for this RFP" },
        { status: 404 }
      );
    }

    type ProposalItem = {
      vendor: { name: string };
      aiScore: number | null;
      pricing: any;
      terms: any;
      rawEmail: string;
      receivedAt: Date;
    };

    // 2. Prepare the context for the AI
    // Simplify the data structure for the LLM
    const proposalData = rfp.proposals.map((p: ProposalItem) => {
      // Prioritize OCR price, then email price
      const finalPrice = p.pricing?.ocrTotalAmount || p.pricing?.totalPrice;

      // Prioritize OCR terms, then email summary terms
      const deliveryString = p.terms?.ocrDeliveryTimeline || p.terms?.summary;

      return {
        vendorName: p.vendor.name,
        finalPrice: finalPrice ? parseFloat(finalPrice) : null,
        // Normalize the delivery time to a single comparable unit (days)
        deliveryDays: normalizeDeliveryToDays(deliveryString),
        aiScore: p.aiScore,
        // Use the newly calculated confidence score, or a default of 50
        priceConfidence: p.pricing?.ocrConfidenceScore || 50,
      };
    });

    const rfpDeadline = (rfp.deadline as Date)?.getTime();
    const rfpDeadlineDays = rfpDeadline
      ? Math.ceil((rfpDeadline - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const contextMessage = `RFP Requirements:\n${JSON.stringify(
      rfp.requirements,
      null,
      2
    )}\n\n--- Proposals (Normalized Data for Comparison):\n${JSON.stringify(
      proposalData,
      null,
      2
    )}
    
    RFP Budget: $${rfp.budget || "N/A"}
    RFP Deadline (Days from submission): ${rfpDeadlineDays || "N/A"}
    
    INSTRUCTIONS FOR WEIGHTED SCORING:
    - Prioritize data with high 'priceConfidence'.
    - Rank 1: PRICE (lowest finalPrice gets highest favorability). Penalize proposals far above the RFP Budget.
    - Rank 2: COMPLETENESS (highest aiScore gets highest favorability).
    - Rank 3: DELIVERY (lowest deliveryDays gets highest favorability, especially if beating the RFP Deadline).
    
    The rationale must justify the winner based on these metrics.
    `;

    // 3. Define the AI System Prompt (Updated to be more directive)
    const systemPrompt = `You are a procurement expert and proposal evaluation engine. Your task is to compare all the provided vendor proposals against the original RFP requirements and the normalized metrics. 

You MUST determine the best vendor and provide a detailed rationale, adhering strictly to the provided Zod schema. The core of your analysis should be based on the calculated metrics: Price, Delivery Time, Quality (aiScore), and the Price Data Confidence.

The schema is: ${JSON.stringify(RecommendationZod.shape)}.
    - Your rationale must mention the price difference, delivery difference, and confidence in the data.`;

    // 4. Call Groq for structured evaluation and recommendation
    const recommendationData = await getStructuredGroqOutput(
      systemPrompt,
      contextMessage,
      RecommendationZod
    );

    // 5. Update the RFP status (optional, but good practice)
    await prisma.rFP.update({
      where: { id: finalRfpId },
      data: { status: "completed" },
    });

    return NextResponse.json(
      {
        status: "ok",
        rfpId: finalRfpId,
        recommendation: recommendationData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Proposal Comparison Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to compare proposals and generate recommendation.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
