// components/RFPTable.tsx - COMPLETE UPDATED VERSION
"use client";

import { DollarSign, List, Send, BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import SendRFPModal from "./SendRFPModal";

interface RFP {
  id: string;
  title: string;
  status: "draft" | "sent" | "responded" | "completed";
  budget: number | null;
  deadline: string | null;
  vendorCount: number;
  proposalCount: number;
  aiScore: number | null;
}

const statusMap: Record<RFP["status"], { text: string; color: string }> = {
  draft: { text: "Draft", color: "bg-gray-200 text-gray-700" },
  sent: { text: "Sent", color: "bg-blue-100 text-blue-700" },
  responded: { text: "In Review", color: "bg-yellow-100 text-yellow-700" },
  completed: { text: "Completed", color: "bg-green-100 text-green-700" },
};

export default function RFPTable({ rfps }: { rfps: RFP[] }) {
  const [localRfps, setLocalRfps] = useState(rfps);
  const [modalRfpId, setModalRfpId] = useState<string | null>(null);

  useEffect(() => {
    setLocalRfps(rfps);
  }, [rfps]);

  const handleRfpSent = (sentRfpId: string) => {
    setLocalRfps((prev) =>
      prev.map((rfp) =>
        rfp.id === sentRfpId
          ? {
              ...rfp,
              status: "sent",
              vendorCount: rfp.vendorCount || 1,
            }
          : rfp
      )
    );
  };

  const rfpInModal = localRfps.find((r) => r.id === modalRfpId);

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-700">Active RFPs</h2>
      </div>

      {/* Desktop Table View */}
      <table className="min-w-full divide-y divide-gray-200 hidden md:table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              RFP Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget / Deadline
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Responses
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {localRfps.map((rfp) => (
            <tr
              key={rfp.id}
              className="hover:bg-gray-50 transition duration-150"
            >
              {/* UPDATED: Clickable Title */}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <Link
                  href={`/rfp/${rfp.id}`}
                  className="text-indigo-600 hover:text-indigo-900 hover:underline"
                >
                  {rfp.title}
                </Link>
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${rfp.budget ? rfp.budget.toLocaleString() : "TBD"} /{" "}
                {rfp.deadline
                  ? new Date(rfp.deadline).toLocaleDateString()
                  : "N/A"}
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    statusMap[rfp.status].color
                  }`}
                >
                  {statusMap[rfp.status].text}
                </span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {rfp.proposalCount} / {rfp.vendorCount}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                {rfp.status === "draft" && (
                  <button
                    onClick={() => setModalRfpId(rfp.id)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition"
                  >
                    <Send className="w-4 h-4 mr-2" /> Select Vendors
                  </button>
                )}

                {(rfp.status === "responded" || rfp.status === "completed") &&
                  rfp.proposalCount > 0 && (
                    <Link
                      href={`/compare/${rfp.id}`}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition"
                    >
                      <BarChart2 className="w-4 h-4 mr-2" />
                      {rfp.proposalCount > 1
                        ? "Compare Proposals"
                        : "View Proposal"}
                    </Link>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile (Card) View */}
      <div className="md:hidden divide-y divide-gray-200">
        {localRfps.map((rfp) => (
          <div key={rfp.id} className="p-4 space-y-2 bg-white hover:bg-gray-50">
            {/* UPDATED: Clickable Title for Mobile */}
            <Link href={`/rfp/${rfp.id}`}>
              <h3 className="font-semibold text-gray-900 text-lg hover:text-indigo-600">
                {rfp.title}
              </h3>
            </Link>

            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Budget: ${rfp.budget ? rfp.budget.toLocaleString() : "TBD"}
              </span>
              <span>
                Deadline:{" "}
                {rfp.deadline
                  ? new Date(rfp.deadline).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  statusMap[rfp.status].color
                }`}
              >
                {statusMap[rfp.status].text}
              </span>
              <span className="text-sm text-gray-600">
                Responses: {rfp.proposalCount} / {rfp.vendorCount}
              </span>
            </div>

            <div className="pt-2">
              {rfp.status === "draft" && (
                <button
                  onClick={() => setModalRfpId(rfp.id)}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition"
                >
                  <Send className="w-4 h-4 mr-2" /> Select Vendors
                </button>
              )}

              {(rfp.status === "responded" || rfp.status === "completed") &&
                rfp.proposalCount > 0 && (
                  <Link
                    href={`/compare/${rfp.id}`}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition"
                  >
                    <BarChart2 className="w-4 h-4 mr-2" />
                    {rfp.proposalCount > 1
                      ? "Compare Proposals"
                      : "View Proposal"}
                  </Link>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Render the Modal */}
      {rfpInModal && (
        <SendRFPModal
          rfpId={rfpInModal.id}
          rfpTitle={rfpInModal.title}
          onClose={() => setModalRfpId(null)}
          onRfpSent={handleRfpSent}
        />
      )}
    </div>
  );
}
