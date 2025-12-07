import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign, Calendar, FileText } from "lucide-react";

async function fetchRFP(rfpId: string) {
  const rfp = await prisma.rFP.findUnique({
    where: { id: rfpId },
    include: {
      rfpVendors: {
        include: {
          vendor: true,
        },
      },
      proposals: {
        include: {
          vendor: true,
        },
      },
    },
  });

  return rfp;
}

export default async function RFPDetailPage(props: {
  params: { rfpId: string } | Promise<{ rfpId: string }>;
}) {
  const resolvedParams = await props.params;
  const rfpId = resolvedParams.rfpId;

  if (!rfpId) {
    return notFound();
  }

  const rfp = await fetchRFP(rfpId);

  if (!rfp) {
    return notFound();
  }

  const requirements = rfp.requirements as any;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-800">{rfp.title}</h1>
        <p className="text-gray-600 mt-2">{rfp.description}</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-xl font-bold text-indigo-600 capitalize">
            {rfp.status}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 flex items-center">
            <DollarSign className="w-4 h-4 mr-1" />
            Budget
          </p>
          <p className="text-xl font-bold text-green-600">
            {rfp.budget ? `$${rfp.budget.toLocaleString()}` : "TBD"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600 flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Deadline
          </p>
          <p className="text-xl font-bold text-orange-600">
            {rfp.deadline
              ? new Date(rfp.deadline).toLocaleDateString()
              : "No deadline"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Proposals</p>
          <p className="text-xl font-bold text-blue-600">
            {rfp.proposals.length} / {rfp.rfpVendors.length}
          </p>
        </div>
      </div>

      {/* Requirements Details */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-indigo-600" />
          Structured Requirements
        </h2>

        {/* Required Items */}
        {requirements.requiredItems && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              Required Items
            </h3>
            <div className="space-y-4">
              {requirements.requiredItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                    <span className="text-sm font-medium text-indigo-600">
                      Qty: {item.quantity}
                    </span>
                  </div>

                  {item.specifications && item.specifications.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {item.specifications.map((spec: string, i: number) => (
                        <li key={i}>{spec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm font-medium text-gray-600">Payment Terms</p>
            <p className="text-base text-gray-900">
              {requirements.paymentTerms || "Not specified"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Warranty</p>
            <p className="text-base text-gray-900">
              {requirements.warranty || "Not specified"}
            </p>
          </div>
        </div>
      </div>

      {/* Vendors Sent To */}
      {rfp.rfpVendors.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            RFP Sent To ({rfp.rfpVendors.length} vendors)
          </h2>
          <div className="space-y-2">
            {rfp.rfpVendors.map((rv) => (
              <div
                key={rv.id}
                className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {rv.vendor.name}
                  </p>
                  <p className="text-sm text-gray-600">{rv.vendor.email}</p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    rv.status === "responded"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {rv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        {rfp.proposals.length > 0 && (
          <Link
            href={`/compare/${rfp.id}`}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            View Proposals & Compare
          </Link>
        )}
      </div>
    </div>
  );
}
