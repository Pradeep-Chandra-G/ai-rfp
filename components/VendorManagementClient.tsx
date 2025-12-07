"use client";

import { useState } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  Building2,
  Trash2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

export default function VendorManagementClient({
  initialVendors,
}: {
  initialVendors: Vendor[];
}) {
  const [vendors, setVendors] = useState(initialVendors);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add vendor");
      }

      setVendors([data, ...vendors]);
      setFormData({ name: "", email: "", phone: "", company: "" });
      setIsAdding(false);
      toast.success(`Vendor "${data.name}" added successfully!`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete vendor");
      }

      setVendors(vendors.filter((v) => v.id !== id));
      toast.success("Vendor deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div>
      {/* Add Vendor Button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="mb-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Add New Vendor
        </button>
      )}

      {/* Add Vendor Form */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl shadow-lg mb-6"
        >
          <h2 className="text-xl font-bold mb-4">Add New Vendor</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="john@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="TechCorp Inc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="555-1234"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {loading ? "Adding..." : "Add Vendor"}
            </button>

            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Vendors List */}
      <div className="bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-700">
            All Vendors ({vendors.length})
          </h2>
        </div>

        {vendors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No vendors added yet. Click &quot;Add New Vendor&quot; to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {vendor.name}
                  </h3>

                  <div className="space-y-1 text-sm text-gray-600">
                    <p className="flex items-center">
                      <Mail className="w-4 h-4 mr-2 text-indigo-500" />
                      {vendor.email}
                    </p>

                    {vendor.company && (
                      <p className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-green-500" />
                        {vendor.company}
                      </p>
                    )}

                    {vendor.phone && (
                      <p className="flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-blue-500" />
                        {vendor.phone}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(vendor.id, vendor.name)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete vendor"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
