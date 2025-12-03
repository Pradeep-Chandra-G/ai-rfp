// app/api/rfp/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStructuredGroqOutput } from "@/lib/groq";
import { StructuredRFPZod } from "@/lib/schemas";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { naturalLanguageInput } = await req.json();

    if (!naturalLanguageInput) {
      return NextResponse.json(
        { error: "Missing naturalLanguageInput" },
        { status: 400 }
      );
    }

    // 1. Define the AI System Prompt
    const systemPrompt = `
You are an **Expert Procurement Assistant** specializing in converting messy, natural language requests into highly structured, machine-readable JSON.

**YOUR PRIMARY GOAL is to produce a valid JSON object that strictly adheres to the provided Zod schema.**

**1. STRICT JSON OUTPUT RULES:**
- **DO NOT** include any introductory text, apologies, explanations, or code blocks (like \`\`\`json). Output the raw JSON object only.
- **NEVER** add fields not explicitly defined in the JSON Schema.
- **CRITICAL:** All string values must be accurate extracts or inferences from the user's input.

**2. DATA EXTRACTION & RESILIENCE RULES:**
- **Required Items:** If the user lists requirements (quantity, specifications), ensure every item is present in the \`requiredItems\` array. If a requirement is complex (e.g., "delivery within 15 days" for one item), include it as a specific string within that item's \`specifications\` array.
- **Payment & Warranty:** The final \`paymentTerms\` and \`warranty\` must reflect the user's explicit, highest-priority, or most specific instruction, even if it contradicts the schema's default. If the user states a range (e.g., "Net 60 preferred, Net 45 acceptable"), capture the range in the string.
- **Budget/Deadline:** If numerical (\`budget\`) or date (\`deadline\`) information is missing, use **null**.
- **Deadline Format:** If a date is mentioned (e.g., "March 31st" or "in 30 days"), calculate the ISO 8601 date string (YYYY-MM-DD) for \`deadline\`. Otherwise, use **null**.

**3. PROVIDED SCHEMA (For Reference):**
${JSON.stringify(StructuredRFPZod.shape)}
`;

    // 2. Call Groq for structured output
    const structuredData = await getStructuredGroqOutput(
      systemPrompt,
      naturalLanguageInput,
      StructuredRFPZod
    );

    // 3. Save the structured RFP to the database
    const newRFP = await prisma.rFP.create({
      data: {
        title: structuredData.title,
        description: structuredData.description,
        budget: structuredData.budget,
        deadline: structuredData.deadline
          ? new Date(structuredData.deadline)
          : undefined,
        requirements: structuredData as any, // Store the structured output as JSON
        status: "draft",
      },
    });

    return NextResponse.json(
      {
        status: "ok",
        rfp: newRFP,
        structuredData: structuredData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("RFP Creation Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to create structured RFP.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
