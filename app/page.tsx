// app/page.tsx
import { ArrowUpRight, DollarSign, List, Send, Plus } from "lucide-react";
import RFPTable from "@/components/RFPTable";
import Link from "next/link";

// Conceptual Type for data fetched from the API
type RFPData = {
  id: string;
  title: string;
  status: "draft" | "sent" | "responded" | "completed";
  budget: number | null;
  deadline: string | null;
  vendorCount: number;
  proposalCount: number;
  aiScore: number | null;
};

// 💡 Data Fetching happens on the Server
async function fetchRFPData(): Promise<RFPData[]> {
  // Replace this with your actual API endpoint for fetching all RFPs
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/rfp`, {
    cache: "no-store", // Fetch fresh data on every request
  });

  if (!res.ok) {
    // This should be handled gracefully in a real app
    throw new Error("Failed to fetch RFPs");
  }

  // NOTE: Assuming your /api/rfp GET route returns the array of RFPs
  return res.json();
}

export default async function DashboardPage() {
  const rfps = await fetchRFPData();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-10 flex justify-between items-center">
        <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">
          AI RFP Management Dashboard 🧠
        </h1>
        <p className="text-sm text-gray-500">
          Analyze proposals, not spreadsheets.
        </p>
      </header>

      <Link
        href="/create"
        className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 mb-12"
      >
        <Plus className="w-5 h-5 mr-2 -ml-1" />Create New
        RFP{" "}
      </Link>

      {/* Pass the data down to the client component for interactivity */}
      <RFPTable rfps={rfps} />
    </div>
  );
}
