// lib/groq.ts - FINAL CORRECTED VERSION (Addressing Groq 400 Error)
import { Groq } from "groq-sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ... (function signature remains the same)
export async function getStructuredGroqOutput<T>(
  systemPrompt: string,
  userMessage: string,
  outputSchema: z.ZodSchema<T>
): Promise<T> {
  console.log("Calling Groq with Structured Output (using json_schema)...");

  // Define a name for the schema, required by Groq API
  const schemaName = "structured_output_schema";

  // 1. Convert the Zod schema to a JSON Schema object.
  // We include the name here for internal documentation, but the Groq API needs it in the response_format payload.
  const schemaForGroq = zodToJsonSchema(outputSchema as any, {
    target: "jsonSchema7",
    name: schemaName,
  }) as any;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    model: "openai/gpt-oss-120b",
    response_format: {
      type: "json_schema",
      json_schema: {
        // 💡 FIX 1: Add the required 'name' property directly to the json_schema object.
        name: schemaName,
        // FIX 2: Pass the schema definition.
        schema: schemaForGroq,
      },
    },
    temperature: 0.1,
  });

  const jsonString = chatCompletion.choices[0]?.message?.content;
  if (!jsonString) {
    throw new Error("Groq API returned an empty response.");
  }

  // 1. Harden the parsing against markdown wrappers (```json) or stray characters
  let cleanedJsonString = jsonString.trim();

  // Remove common markdown wrappers used by LLMs (```json or ```)
  if (cleanedJsonString.startsWith("```")) {
    cleanedJsonString = cleanedJsonString
      .replace(/^```json\s*|```\s*$/g, "")
      .trim();
  }

  // CRITICAL FIX: Add a try-catch block to handle malformed JSON output
  try {
    // 2. Parse the cleaned JSON string
    const jsonResponse = JSON.parse(cleanedJsonString);

    // 3. Validate and return the data using Zod
    return outputSchema.parse(jsonResponse);
  } catch (parseError) {
    // Log the actual raw string that failed to parse
    console.error("JSON Parsing Failed. Raw Groq output:", jsonString);
    console.error("Cleaned string that failed:", cleanedJsonString);

    // Throw a clearer error for the API route to handle (HTTP 500)
    throw new Error(
      `AI structured output failed to parse into JSON. Check console for raw output. Original error: ${
        parseError instanceof Error
          ? parseError.message
          : "Unknown parsing error"
      }`
    );
  }
}
