// app/vendors/page.tsx
import { prisma } from "@/lib/db";
import VendorManagementClient from "../../components/VendorManagementClient";

async function fetchVendors() {
  return await prisma.vendor.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export default async function VendorsPage() {
  const vendors = await fetchVendors();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">Vendor Management</h1>
        <p className="text-gray-600 mt-1">
          Add and manage your vendor database
        </p>
      </header>

      <VendorManagementClient initialVendors={vendors} />
    </div>
  );
}
