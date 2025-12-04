// app/proposal/[proposalId]/page.tsx
import { prisma } from "@/lib/db";
import ProposalDetailClient from "@/components/ProposalDetailClient";
import { notFound } from "next/navigation";
import { DollarSign, FileText, Zap } from "lucide-react";

// Define the comprehensive data structure
type ProposalDetailData = {
  id: string;
  rfpTitle: string;
  vendorName: string;
  receivedAt: string; // Serialized date string
  aiScore: number | null;
  aiSummary: string | null;
  rawEmail: string;
  pricing: any;
  terms: any;
  attachments: { filename: string; url: string; mimeType: string }[];
};

// --- Data Fetching Function ---
async function fetchProposalDetails(
  proposalId: string
): Promise<ProposalDetailData> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      rfp: {
        select: { title: true }, // Need the RFP title
      },
      vendor: {
        select: { name: true, email: true }, // Need the Vendor name
      },
    },
  });

  if (!proposal) {
    return notFound();
  }

  return {
    id: proposal.id,
    rfpTitle: proposal.rfp.title,
    vendorName: proposal.vendor.name,
    receivedAt: proposal.receivedAt.toISOString(), // Must be serialized
    aiScore: proposal.aiScore,
    aiSummary: proposal.aiSummary,
    rawEmail: proposal.rawEmail,
    pricing: proposal.pricing,
    terms: proposal.terms,
    // Ensure attachments is an array, handling the JSON field casting
    attachments: proposal.attachments as {
      filename: string;
      url: string;
      mimeType: string;
    }[],
  };
}

// --- Page Component ---
export default async function ProposalDetailPage(props: {
  params: { proposalId: string };
}) {
  const resolvedParams = await props.params;
  const proposalId = resolvedParams.proposalId;

  // Safety check for parameter
  if (!proposalId) {
    return notFound();
  }

  // Fetch and handle the not found case
  const data = await fetchProposalDetails(proposalId);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 border-b pb-4">
        <p className="text-sm text-indigo-600 font-medium">
          Proposal for: {data.rfpTitle}
        </p>
        <h1 className="text-3xl font-bold text-gray-800">
          Proposal from {data.vendorName}
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          Received on: {new Date(data.receivedAt).toLocaleDateString()}
        </p>
      </header>

      <ProposalDetailClient proposal={data} />
    </div>
  );
}
