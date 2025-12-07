"use client";

import { FileText, Eye, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// --- 1. Define Specific Types for Pricing Data ---
interface ProposalPricingData {
  ocrDetectedItems?: any;
  ocrTotalAmount?: number | null;
  ocrConfidenceScore?: number | null; // Added 'null' for safety
  [key: string]: any;
}

interface OCRResultsSectionProps {
  proposalId: string;
  attachments: { filename: string; url: string; mimeType: string }[];
  currentPricing: ProposalPricingData; 
  currentTerms: any;
}

// --- 2. Confidence Badge Helper ---
const getConfidenceBadge = (score: number | null | undefined) => {
  // FIX: Explicitly check for null, undefined, or NaN
  if (score === undefined || score === null || isNaN(score)) { 
    return { text: "N/A", classes: "bg-gray-200 text-gray-700" };
  }

  const scoreValue = Math.round(score);

  if (scoreValue >= 80) {
    return {
      text: `${scoreValue}% High`,
      classes: "bg-green-100 text-green-700 font-bold",
    };
  } else if (scoreValue >= 50) {
    return {
      text: `${scoreValue}% Medium`,
      classes: "bg-yellow-100 text-yellow-700 font-bold",
    };
  } else {
    return {
      text: `${scoreValue}% Low`,
      classes: "bg-red-100 text-red-700 font-bold",
    };
  }
};

export default function OCRResultsSection({
  proposalId,
  attachments,
  currentPricing,
  currentTerms,
}: OCRResultsSectionProps) {
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  // Check if OCR data already exists
  const hasOCRData =
    currentPricing?.ocrDetectedItems || currentTerms?.ocrAdditionalNotes;

  const handleReprocessOCR = async () => {
    if (!confirm("Reprocess attachments with OCR? This may take a minute."))
      return;

    setProcessing(true);
    // 1. Capture the toast ID for the loading state
    const toastId = toast.loading("Processing attachments with OCR..."); 

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/process-attachments`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || "Failed to process attachments");
      }

      // 2. Dismiss the loading toast and show success
      toast.dismiss(toastId); 
      toast.success("✅ OCR processing complete! Updating view...");
      
      // 3. Force page refresh to fetch new data
      router.refresh();

    } catch (error: any) {
      // 4. Dismiss the loading toast and show error
      toast.dismiss(toastId);
      toast.error(`❌ OCR Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  const confidenceBadge = getConfidenceBadge(
    currentPricing?.ocrConfidenceScore
  );

  return (
    <div className="bg-white shadow-xl rounded-xl border border-gray-100">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Eye className="w-5 h-5 mr-2 text-purple-600" />
            AI OCR Analysis
          </h3>

          <button
            onClick={handleReprocessOCR}
            disabled={processing}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                {hasOCRData ? "Reprocess OCR" : "Run OCR Analysis"}
              </>
            )}
          </button>
        </div>

        {hasOCRData && (
          <div className="space-y-6">
            
            {/* CONFIDENCE SCORE CARD */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50">
              <div className="flex flex-col">
                <span className="font-semibold text-purple-700 flex items-center mb-1">
                  <Zap className="w-5 h-5 mr-2" /> Price Data Confidence:
                </span>
                <p className="text-xs text-gray-500 ml-7">
                  Measures reliability based on alignment between email and
                  attachment totals.
                </p>
              </div>
              <span
                className={`px-3 py-1 text-sm rounded-full ${confidenceBadge.classes}`}
              >
                {confidenceBadge.text}
              </span>
            </div>

            {/* OCR Detected Pricing */}
            {currentPricing?.ocrDetectedItems && (
              <div className="bg-white p-4 rounded-lg shadow border border-gray-100 text-black">
                <h4 className="font-semibold text-gray-700 mb-2">
                  📊 Items Detected in Attachments
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPricing.ocrDetectedItems.map(
                        (item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{item.item}</td>
                            <td className="px-3 py-2 text-right">
                              {item.quantity || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.unitPrice
                                ? `$${item.unitPrice.toLocaleString()}`
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {item.totalPrice
                                ? `$${item.totalPrice.toLocaleString()}`
                                : "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {currentPricing.ocrTotalAmount && (
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="font-semibold">Total from OCR:</span>
                    <span className="text-xl font-bold text-green-600">
                      ${currentPricing.ocrTotalAmount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* OCR Terms */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-100 space-y-3">
              {currentTerms?.ocrDeliveryTimeline && (
                <div>
                  <span className="font-semibold text-gray-700">
                    🚚 Delivery:
                  </span>
                  <p className="text-gray-600 mt-1">
                    {currentTerms.ocrDeliveryTimeline}
                  </p>
                </div>
              )}

              {currentTerms?.ocrWarrantyInfo && (
                <div>
                  <span className="font-semibold text-gray-700">
                    🛡️ Warranty:
                  </span>
                  <p className="text-gray-600 mt-1">
                    {currentTerms.ocrWarrantyInfo}
                  </p>
                </div>
              )}

              {currentTerms?.ocrPaymentTerms && (
                <div>
                  <span className="font-semibold text-gray-700">
                    💳 Payment:
                  </span>
                  <p className="text-gray-600 mt-1">
                    {currentTerms.ocrPaymentTerms}
                  </p>
                </div>
              )}

              {currentTerms?.ocrAdditionalNotes && (
                <div>
                  <span className="font-semibold text-gray-700">📝 Notes:</span>
                  <p className="text-gray-600 mt-1 italic">
                    {currentTerms.ocrAdditionalNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasOCRData && (
          <p className="text-gray-600 text-sm">
            Click &quot;Run OCR Analysis&quot; to extract structured data from
            the {attachments.length} attached file(s).
          </p>
        )}
      </div>
    </div>
  );
}