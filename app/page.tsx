// app/page.tsx
import { ArrowUpRight, DollarSign, List, Send } from "lucide-react";
import RFPTable from "@/components/RFPTable";

// Conceptual Type for data fetched from the API
type RFPData = {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'responded' | 'completed';
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
    cache: 'no-store' // Fetch fresh data on every request
  });

  if (!res.ok) {
    // This should be handled gracefully in a real app
    throw new Error('Failed to fetch RFPs');
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
      
      {/* Pass the data down to the client component for interactivity */}
      <RFPTable rfps={rfps} />
    </div>
  );
}