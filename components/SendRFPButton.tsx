// components/SendRFPButton.tsx
'use client';

import { Send, Loader2 } from "lucide-react";
import { useState } from 'react';
import toast from 'react-hot-toast'; 
import { API_BASE_URL } from '@/lib/constants'; // Assuming this is correct

interface SendRFPButtonProps {
    rfpId: string;
    vendorIds: string[];
    onSuccess: () => void;
    // 💡 FIX 1: Add the disabled prop to the interface
    disabled?: boolean; // Use optional chaining just in case
}

export default function SendRFPButton({ rfpId, vendorIds, onSuccess, disabled }: SendRFPButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!confirm("Are you sure you want to send this RFP to the selected vendors?")) return;

        setLoading(true);
        try {
            const API_URL = `${API_BASE_URL}/api/rfp`;
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rfpId, vendorIds }),
            });

            const data = await response.json();

            if (!response.ok || data.status === 'error') {
                throw new Error(data.message || "Failed to send RFP.");
            }

            toast.success(data.message || "RFP sent successfully!");
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSend}
            // 💡 FIX 2: Apply the loading state OR the passed 'disabled' prop
            disabled={loading || disabled}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition disabled:opacity-50"
        >
            {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
                <Send className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Sending...' : 'Send RFP'}
        </button>
    );
}