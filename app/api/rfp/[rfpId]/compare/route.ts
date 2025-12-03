// app/api/rfp/[rfpId]/compare/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { prisma } from "@/lib/db";
import { z } from "zod";

// Zod Schema for the final AI Recommendation Output
const RecommendationZod = z.object({
  recommendation: z.string().describe("The name of the recommended vendor."),
  rationale: z
    .string()
    .describe(
      "A detailed, 3-5 sentence explanation of why this vendor is recommended, focusing on price, completeness, and terms."
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
          .describe("The completeness score from the initial parsing."),
        totalPrice: z.number().nullable().describe("The final quoted price."),
        deliveryEstimate: z
          .number()
          .int()
          .nullable()
          .describe("Delivery estimate in days."),
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

// Define the expected Context type for clarity
// export interface Context {
//   params: {
//     rfpId: string;
//   };
// }

export async function GET(req: NextRequest, context: any) {
  try {
    const rfpId = context.params.rfpId as string;

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
      aiScore: number;
      pricing: any;
      terms: any;
      rawEmail: string;
      receivedAt: Date;
    };

    // 2. Prepare the context for the AI
    // Simplify the data structure for the LLM
    const proposalData = rfp.proposals.map((p: ProposalItem) => ({
      vendorName: p.vendor.name,
      aiScore: p.aiScore,
      pricing: p.pricing, // JSON object from the database
      terms: p.terms, // JSON object from the database
      rawEmailSnippet: p.rawEmail.substring(0, 500) + "...", // Limit size
      receivedAt: p.receivedAt,
    }));

    const contextMessage = `RFP Requirements:\n${JSON.stringify(
      rfp.requirements,
      null,
      2
    )}\n\n--- Proposals:\n${JSON.stringify(proposalData, null, 2)}`;

    // 3. Define the AI System Prompt
    const systemPrompt = `You are a procurement expert and proposal evaluation engine. Your task is to compare all the provided vendor proposals against the original RFP requirements. You MUST determine the best vendor and provide a detailed rationale, adhering strictly to the provided Zod schema. The schema is: ${JSON.stringify(
      RecommendationZod.shape
    )}.
    - The primary criteria are meeting requirements (AI Score), lowest Total Price, and favorable terms.
    - Analyze the differences in price and specifications carefully to make a justifiable recommendation.`;

    // 4. Call Groq for structured evaluation and recommendation
    const recommendationData = await getStructuredGroqOutput(
      systemPrompt,
      contextMessage,
      RecommendationZod
    );

    // 5. Update the RFP status (optional, but good practice)
    await prisma.rFP.update({
      where: { id: rfpId },
      data: { status: "completed" },
    });

    return NextResponse.json(
      {
        status: "ok",
        rfpId: rfpId,
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
