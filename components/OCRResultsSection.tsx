// components/OCRResultsSection.tsx - NEW FILE
"use client";

import { FileText, Eye, Loader2 } from "lucide-react";
import { useState } from "react";

interface OCRResult {
  detectedPricing: {
    item: string;
    unitPrice: number | null;
    quantity: number | null;
    totalPrice: number | null;
  }[];
  totalAmount: number | null;
  deliveryTimeline: string | null;
  warrantyInfo: string | null;
  paymentTerms: string | null;
  additionalNotes: string;
}

interface OCRResultsSectionProps {
  proposalId: string;
  attachments: { filename: string; url: string; mimeType: string }[];
  currentPricing: any;
  currentTerms: any;
}

export default function OCRResultsSection({
  proposalId,
  attachments,
  currentPricing,
  currentTerms,
}: OCRResultsSectionProps) {
  const [processing, setProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<OCRResult | null>(null);

  // Check if OCR data already exists
  const hasOCRData =
    currentPricing?.ocrDetectedItems || currentTerms?.ocrAdditionalNotes;

  const handleReprocessOCR = async () => {
    if (!confirm("Reprocess attachments with OCR? This may take a minute."))
      return;

    setProcessing(true);

    try {
      const response = await fetch(
        `/api/proposals/${proposalId}/process-attachments`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || "Failed to process attachments");
      }

      setOcrData(data.structuredData);
      alert("✅ OCR processing complete! Refresh the page to see updates.");
    } catch (error: any) {
      alert(`❌ OCR Error: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="bg-linear-to-r from-purple-50 to-blue-50 p-6 rounded-xl border-2 border-purple-200">
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
        <div className="space-y-4">
          {/* OCR Detected Pricing */}
          {currentPricing?.ocrDetectedItems && (
            <div className="bg-white p-4 rounded-lg shadow">
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
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
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
                <span className="font-semibold text-gray-700">💳 Payment:</span>
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
          Click &quot;Run OCR Analysis&quot; to extract structured data from the{" "}
          {attachments.length} attached file(s).
        </p>
      )}
    </div>
  );
}
