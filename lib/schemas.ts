// lib/schemas.ts
import { z } from "zod";

// 1. Schema for converting Natural Language to Structured RFP Requirements
export const StructuredRFPZod = z.object({
  title: z.string().describe("A concise, descriptive title for the RFP."),
  description: z
    .string()
    .describe("A full description of the procurement need."),
  budget: z
    .number()
    .nullable()
    .describe("Total stated budget or null if not specified."),
  deadline: z
    .string()
    .nullable()
    .describe(
      "Target completion/delivery date in ISO format or 'TBD' if not specified."
    ),
  requiredItems: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().int(),
        specifications: z
          .array(z.string())
          .describe(
            "A list of key required features, e.g., '16GB RAM', '27-inch'."
          ),
      })
    )
    .describe("The list of products or services needed."),
  paymentTerms: z
    .string()
    .default("Net 30")
    .describe("The required payment terms, e.g., 'net 30', 'net 60'."),
  warranty: z
    .string()
    .default("1 year minimum")
    .describe("Minimum required warranty or service agreement duration."),
});

export type StructuredRFP = z.infer<typeof StructuredRFPZod>;

// 2. Schema for parsing a Vendor's Proposal
export const StructuredProposalZod = z.object({
  totalPrice: z
    .number()
    .nullable()
    .describe("The final total cost quoted by the vendor, or null if complex."),
  currency: z
    .string()
    .default("USD")
    .describe("The currency of the quoted price."),
  deliveryEstimateDays: z
    .number()
    .int()
    .nullable()
    .describe("Estimated delivery time in days."),
  warrantyPeriod: z
    .string()
    .describe("The warranty period offered by the vendor."),
  pricingDetails: z
    .array(
      z.object({
        item: z.string(),
        unitPrice: z.number(),
        quantityOffered: z.number().int(),
      })
    )
    .describe("Detailed breakdown of items and prices."),
  completenessScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "AI score for how well the vendor addressed all RFP requirements (0-100)."
    ),
  keyTermsSummary: z
    .string()
    .describe("A 2-3 sentence summary of the proposal's terms and conditions."),
});

export type StructuredProposal = z.infer<typeof StructuredProposalZod>;
