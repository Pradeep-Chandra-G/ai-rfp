import { Zap, DollarSign, Clock, FileText } from "lucide-react";
import Link from "next/link";

interface Proposal {
  id: string;
  vendorName: string;
  aiScore: number | null;
  receivedAt: string; // Changed to string for serialization
  aiSummary: string | null;
  // Note: These fields are stored as JSON in Prisma, hence the 'any' type
  pricing: any;
  terms: any;
}

interface ProposalCardProps {
  proposal: Proposal;
}

// Helper function to format the AI Score badge
const getScoreBadge = (score: number | null) => {
  if (score === null) {
    return { text: "N/A", classes: "bg-gray-200 text-gray-700" };
  }
  const scoreValue = Math.round(score);

  if (scoreValue >= 90) {
    return { text: `${scoreValue}%`, classes: "bg-green-100 text-green-800" };
  } else if (scoreValue >= 70) {
    return { text: `${scoreValue}%`, classes: "bg-yellow-100 text-yellow-800" };
  } else {
    return { text: `${scoreValue}%`, classes: "bg-red-100 text-red-800" };
  }
};

export default function ProposalCard({ proposal }: ProposalCardProps) {
  const scoreBadge = getScoreBadge(proposal.aiScore);
  const quotedPrice =
    proposal.pricing?.ocrTotalAmount ||
    proposal.pricing?.totalPrice ||
    proposal.pricing?.estimatedCost;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col h-full hover:shadow-xl transition duration-300">
      {/* Header: Vendor Name & Status */}
      <div className="flex justify-between items-start mb-3 border-b pb-3">
        <h3 className="text-xl font-bold text-gray-900">
          {proposal.vendorName}
        </h3>
        <span className="text-xs text-gray-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {proposal.receivedAt}
        </span>
      </div>

      {/* AI Score and Pricing */}
      <div className="space-y-4 mb-4 grow">
        {/* AI Score */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50">
          <span className="font-semibold text-indigo-700 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-indigo-500" /> AI Completeness:
          </span>
          <span
            className={`px-3 py-1 text-sm font-bold rounded-full ${scoreBadge.classes}`}
          >
            {scoreBadge.text}
          </span>
        </div>

        {/* Quoted Price */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" /> Quoted Price:
          </span>
          <span className="font-bold text-xl text-green-700">
            {/* Use the fixed quotedPrice variable here */}
            {quotedPrice ? `$${quotedPrice.toLocaleString()}` : "Price N/A"}
          </span>
        </div>

        {/* AI Summary */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="font-semibold text-gray-700 flex items-center mb-2">
            <FileText className="w-4 h-4 mr-2 text-blue-500" /> Key Summary:
          </h4>
          <p className="text-sm italic text-gray-600 line-clamp-3">
            {proposal.aiSummary || "Summary is pending or failed to parse."}
          </p>
        </div>
      </div>

      {/* Footer: Action Link */}
      <Link
        href={`/proposal/${proposal.id}`}
        className="mt-4 text-center block w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition"
      >
        View Full Details →
      </Link>
    </div>
  );
}
