// components/ProposalDetailClient.tsx - UPDATED WITH OCR SECTION
"use client";

import {
  DollarSign,
  FileText,
  Zap,
  Clock,
  Paperclip,
  Code,
} from "lucide-react";
import { useState } from "react";
import OCRResultsSection from "../components/OCRResultsSection";

interface Proposal {
  id: string;
  rfpTitle: string;
  vendorName: string;
  receivedAt: string;
  aiScore: number | null;
  aiSummary: string | null;
  rawEmail: string;
  pricing: any;
  terms: any;
  attachments: { filename: string; url: string; mimeType: string }[];
}

interface ProposalDetailClientProps {
  proposal: Proposal;
}

export default function ProposalDetailClient({
  proposal,
}: ProposalDetailClientProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const scoreText =
    proposal.aiScore !== null ? `${Math.round(proposal.aiScore)}%` : "N/A";

  const primaryPrice =
    proposal.pricing?.ocrTotalAmount ||
    proposal.pricing?.totalPrice ||
    proposal.pricing?.estimatedCost;

  const formattedPrice = primaryPrice
    ? `$${primaryPrice.toLocaleString()}`
    : "N/A";

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
            <Zap className="w-5 h-5 mr-2 text-indigo-500" /> AI Completeness
            Score
          </h3>
          <p className="text-4xl font-extrabold text-indigo-800">{scoreText}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
            <DollarSign className="w-5 h-5 mr-2 text-green-500" /> Quoted Price
          </h3>
          <p className="text-3xl font-extrabold text-green-800">
            {formattedPrice}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center mb-2">
            <Paperclip className="w-5 h-5 mr-2 text-blue-500" /> Attachments
          </h3>
          <p className="text-2xl font-extrabold text-blue-800">
            {proposal.attachments.length} Files
          </p>
        </div>
      </div>

      {/* OCR Results Section - NEW */}
      {proposal.attachments.length > 0 && (
        <div className="mb-8">
          <OCRResultsSection
            proposalId={proposal.id}
            attachments={proposal.attachments}
            currentPricing={proposal.pricing}
            currentTerms={proposal.terms}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("summary")}
            className={`py-2 px-1 text-sm font-medium border-b-2 ${
              activeTab === "summary"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } transition`}
          >
            Structured Summary
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`py-2 px-1 text-sm font-medium border-b-2 ${
              activeTab === "raw"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-700"
            } transition`}
          >
            <Code className="w-4 h-4 mr-1 inline-block" /> Raw Email & Data
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white p-8 rounded-xl shadow-lg">
        {activeTab === "summary" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <FileText className="w-6 h-6 mr-2" /> Key Takeaways
            </h2>

            {/* AI Summary */}
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-700 mb-2">
                AI Generated Summary
              </h3>
              <p className="text-gray-800">
                {proposal.aiSummary || "Summary not available."}
              </p>
            </div>

            {/* Attachments List */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
                <Paperclip className="w-4 h-4 mr-2" /> Download Attachments
              </h3>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                {proposal.attachments.map((file, index) => (
                  <li key={index}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {file.filename} ({file.mimeType})
                    </a>
                  </li>
                ))}
              </ul>
              {proposal.attachments.length === 0 && (
                <p className="text-gray-500 text-sm">
                  No files were attached to this proposal.
                </p>
              )}
            </div>

            {/* Pricing and Terms Details */}
            <h3 className="text-xl font-bold text-gray-800 pt-4 border-t mt-6">
              Structured Data (JSON)
            </h3>
            <pre className="bg-gray-800 text-green-300 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(
                { pricing: proposal.pricing, terms: proposal.terms },
                null,
                2
              )}
            </pre>
          </div>
        )}

        {activeTab === "raw" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Raw Email Body</h2>
            <pre className="bg-gray-800 text-gray-300 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap">
              {proposal.rawEmail}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
