"use client";

import { useState, useEffect } from "react";
import { Loader2, UserPlus, X, Mail } from "lucide-react";
import SendRFPButton from "./SendRFPButton"; // Reuses the existing button logic

interface Vendor {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

interface SendRFPModalProps {
  rfpId: string;
  rfpTitle: string;
  onClose: () => void;
  onRfpSent: (rfpId: string) => void;
}

export default function SendRFPModal({
  rfpId,
  rfpTitle,
  onClose,
  onRfpSent,
}: SendRFPModalProps) {
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const response = await fetch("/api/vendors");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load vendors.");
        }

        setAvailableVendors(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Vendor fetch error:", err);
      } finally {
        setIsLoadingVendors(false);
      }
    };

    fetchVendors();
  }, []);

  // --- State Handlers ---
  const handleSelectVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId)
        ? prev.filter((id) => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const handleSendSuccess = () => {
    onRfpSent(rfpId); // Update the dashboard status
    onClose(); // Close the modal
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-2xl font-bold text-indigo-800 flex items-center">
            <Mail className="w-6 h-6 mr-2" />
            Send RFP: {rfpTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-600 mb-4">
          Select the vendors you wish to send this Request for Proposal to. You
          must select at least one.
        </p>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg mb-4">
            {error}
          </div>
        )}

        {isLoadingVendors ? (
          <div className="flex justify-center items-center h-32 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Vendors...
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-3 p-2 border rounded-lg">
            {availableVendors.length === 0 ? (
              <p className="text-center text-gray-500">
                No vendors available. Please add vendors to your master list.
              </p>
            ) : (
              availableVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  onClick={() => handleSelectVendor(vendor.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition flex items-center justify-between ${
                    selectedVendorIds.includes(vendor.id)
                      ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-300"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900 flex items-center">
                      <UserPlus className="w-4 h-4 mr-2 text-indigo-600" />
                      {vendor.name}
                    </p>
                    <p className="text-xs text-gray-500 ml-6">
                      {vendor.company} | {vendor.email}
                    </p>
                  </div>
                  {selectedVendorIds.includes(vendor.id) && (
                    <span className="text-xs font-semibold text-indigo-600">
                      Selected
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer and Action */}
        <div className="mt-6 pt-4 border-t flex justify-end items-center space-x-3">
          <p className="text-sm font-medium text-gray-700">
            Selected:{" "}
            <span className="text-indigo-600">{selectedVendorIds.length}</span>
          </p>
          <SendRFPButton
            rfpId={rfpId}
            vendorIds={selectedVendorIds}
            onSuccess={handleSendSuccess}
            disabled={selectedVendorIds.length === 0 || isLoadingVendors}
          />
        </div>
      </div>
    </div>
  );
}
