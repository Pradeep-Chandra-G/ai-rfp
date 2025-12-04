// app/compare/[rfpId]/page.tsx (Server Component)

import { prisma } from "@/lib/db";
import ProposalReviewClient from "@/components/ProposalReviewClient";
import { Zap, List, DollarSign } from "lucide-react";
import { notFound } from "next/navigation";

// Define structured types for the page
type ProposalData = {
  id: string;
  vendorName: string;
  aiScore: number | null;
  receivedAt: Date;
  // We only need a summary for the initial view
  aiSummary: string | null;
  pricing: any;
  terms: any;
};

// Fetch data on the server
async function fetchRFPAndProposals(rfpId: string) {
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
    return notFound();
  }

  const proposals: ProposalData[] = rfp.proposals.map((p) => ({
    id: p.id,
    vendorName: p.vendor.name,
    aiScore: p.aiScore,
    receivedAt: p.receivedAt,
    aiSummary: p.aiSummary,
    pricing: p.pricing,
    terms: p.terms,
  }));

  return {
    rfpTitle: rfp.title,
    rfpRequirements: rfp.requirements,
    proposals: proposals,
  };
}

export default async function ProposalReviewPage({
  params,
}: {
  params: { rfpId: string };
}) {
  const data = await fetchRFPAndProposals(params.rfpId);

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

      <ProposalReviewClient rfpId={params.rfpId} proposals={data.proposals} />
    </div>
  );
}
