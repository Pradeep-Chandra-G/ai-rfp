// app/compare/[rfpId]/page.tsx (Final Refactoring)

import { prisma } from "@/lib/db";
import ProposalReviewClient from "@/components/ProposalReviewClient";
import { notFound } from "next/navigation"; // Do not use unused imports (Zap, List, DollarSign)

// Define structured types for the page
type ProposalData = {
  id: string;
  vendorName: string;
  aiScore: number | null;
  // 🛑 CORRECT: Must be a serializable string for Server Component props
  receivedAt: string;
  aiSummary: string | null;
  pricing: any;
  terms: any;
};

// Fetch data on the server
async function fetchRFPAndProposals(rfpId: string) {
  // 🛑 FIX: Use a try/catch block around the data fetch to debug external errors
  try {
    const rfp = await prisma.rFP.findUnique({
      where: { id: rfpId },
      include: {
        proposals: {
          include: {
            vendor: true, // Get vendor name
          },
          orderBy: {
            receivedAt: "asc",
          },
        },
      },
    });

    if (!rfp) {
      // Return null or throw an error to signal no data found
      return null;
    }

    const proposals: ProposalData[] = rfp.proposals.map((p) => ({
      id: p.id,
      vendorName: p.vendor.name,
      aiScore: p.aiScore,
      // 🛑 CRITICAL FIX: Ensure Date is converted to a serializable string
      receivedAt: p.receivedAt.toISOString(),
      aiSummary: p.aiSummary,
      // JSON fields are safely passed as 'any'
      pricing: p.pricing,
      terms: p.terms,
    }));

    return {
      rfpTitle: rfp.title,
      rfpRequirements: rfp.requirements,
      proposals: proposals,
    };
  } catch (e) {
    // Log the specific Prisma/DB error if the query fails unexpectedly
    console.error("Prisma/DB Query Failed during fetchRFPAndProposals:", e);
    return null; // Return null on database failure
  }
}

export default async function ProposalReviewPage(props: {
  params: { rfpId: string } | Promise<{ rfpId: string }>;
}) {
  // 1. Parameter Validation
  const resolvedParams = await props.params; // Using props ensures resolution
  const rfpId = resolvedParams.rfpId;

  if (!rfpId) {
    // This handles the promise resolution failure leading to undefined
    console.warn("RFP ID parameter was null or undefined in params object.");
    return notFound();
  }

  // 2. Data Fetch
  const data = await fetchRFPAndProposals(rfpId);

  // 3. Final Existence Check
  if (!data) {
    // This handles both the 'Prisma returned null' and 'Prisma/DB query failed' cases
    return notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          Proposal Review: {data.rfpTitle}
        </h1>
        <p className="text-gray-600 mt-1">
          {data.proposals.length} proposals received.
        </p>
      </header>

      <ProposalReviewClient rfpId={rfpId} proposals={data.proposals} />
    </div>
  );
}
