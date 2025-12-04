// components/ProposalReviewClient.tsx
"use client";

import { useState } from "react";
import { Loader2, Zap, BarChart2, CheckCircle, DollarSign } from "lucide-react";
import toast from "react-hot-toast";
import { Recommendation } from "@/app/api/rfp/[rfpId]/compare/route"; // Import the type
import ProposalCard from "./ProposalCard";

// Define the expected Proposal type from the server component
interface Proposal {
  id: string;
  vendorName: string;
  aiScore: number | null;
  receivedAt: Date;
  aiSummary: string | null;
  pricing: any;
  terms: any;
}

interface ProposalReviewClientProps {
  rfpId: string;
  proposals: Proposal[];
}

export default function ProposalReviewClient({
  rfpId,
  proposals,
}: ProposalReviewClientProps) {
  const [loading, setLoading] = useState(false);
  const [comparisonResult, setComparisonResult] =
    useState<Recommendation | null>(null);

  const handleCompare = async () => {
    setLoading(true);
    setComparisonResult(null);
    try {
      // Calls the route you developed earlier: /api/rfp/[rfpId]/compare
      const response = await fetch(`/api/rfp/${rfpId}/compare`, {
        method: "GET",
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.details || data.message || "Failed to generate comparison."
        );
      }

      setComparisonResult(data.recommendation);
      toast.success("AI Comparison Complete!");
    } catch (error: any) {
      toast.error(error.message || "Error running AI comparison.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Check if enough proposals exist to run the comparison
  const canCompare = proposals.length > 0;

  return (
    <>
      {/* Action Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleCompare}
          disabled={loading || !canCompare}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          ) : (
            <Zap className="w-5 h-5 mr-3" />
          )}
          {loading
            ? "Generating Analysis..."
            : `Run AI Comparison (${proposals.length} Proposals)`}
        </button>
      </div>

      {/* AI Comparison Results Section */}
      {comparisonResult && (
        <div className="mb-8 bg-indigo-50 p-6 rounded-xl shadow-inner border border-indigo-200">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center">
            <BarChart2 className="w-6 h-6 mr-2" /> AI Recommendation
          </h2>
          <p className="text-xl font-semibold text-indigo-900 mb-3">
            Recommended Vendor: {comparisonResult.recommendation}
          </p>
          <p className="text-gray-700 italic mb-4">
            {comparisonResult.rationale}
          </p>

          {/* Display Action Items */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Next Steps / Action Items:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {comparisonResult.actionItems.map((item, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="w-4 h-4 mr-2 mt-1 text-green-500 flex-shrink-0" />{" "}
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Proposal Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </>
  );
}
