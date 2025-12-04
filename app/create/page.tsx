// app/create/page.tsx
import CreateRFPForm from "@/components/CreateRFPForm";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Create New RFP | AI Procurement",
};

export default function CreateRFPPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center tracking-tight">
          <Plus className="w-6 h-6 mr-2 text-indigo-600" /> 
          Generate New RFP from Text
        </h1>
        <p className="text-gray-600 mt-2">
          Paste a detailed description of your procurement needs below. Our AI will automatically structure the requirements, budget, and deadlines.
        </p>
      </header>
      
      <CreateRFPForm />
    </div>
  );
}