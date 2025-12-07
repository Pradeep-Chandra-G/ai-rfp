"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function CreateRFPForm() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      toast.error("Please enter a description for the RFP.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/rfp/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naturalLanguageInput: input.trim() }),
      });

      const data = await response.json();

      if (!response.ok || data.status === "error") {
        throw new Error(
          data.details || data.message || "Failed to structure RFP with AI."
        );
      }

      toast.success(`RFP "${data.rfp.title}" created successfully!`);
      // Redirect to the main dashboard to view the new 'draft' RFP
      router.push("/");
    } catch (error: Error | unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during creation.";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 shadow-lg rounded-xl">
      <div className="mb-4">
        <label
          htmlFor="rfpInput"
          className="block text-lg font-medium text-gray-700 mb-2"
        >
          RFP Description
        </label>
        <textarea
          id="rfpInput"
          rows={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="I need 10 high-performance laptops with a minimum of 32GB RAM, 1TB SSD, and a 15-inch display. The budget is negotiable but ideally under $200,000 total. Please include a 3-year warranty and a delivery timeline. Reply by next Friday."
          className="w-full border border-gray-300 rounded-lg p-4 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 shadow-sm transition"
          required
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
        ) : (
          <Zap className="w-5 h-5 mr-3" />
        )}
        {loading ? "Analyzing & Creating Draft..." : "Generate Structured RFP"}
      </button>
    </form>
  );
}
