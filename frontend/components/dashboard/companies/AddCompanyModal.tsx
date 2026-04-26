"use client";

/**
 * FinWatch Zambia - Add Company Modal
 *
 * Modal for registering a new SME company with validation for
 * company name, industry, registration number, and description.
 */

import { useState } from "react";
import { X, Building2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  name: string;
  industry: string;
  registration_number: string;
  description: string;
}

const INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Financial Services",
  "Healthcare",
  "Hospitality & Tourism",
  "Manufacturing",
  "Mining",
  "Real Estate",
  "Retail & Trade",
  "Technology",
  "Transport & Logistics",
  "Other",
];

const INDUSTRY_OPTIONS = INDUSTRIES.map(ind => ({
  value: ind,
  label: ind
}));

export function AddCompanyModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>({
    name: "",
    industry: "",
    registration_number: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  if (!open) return null;

  function handleFieldChange(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  }

  async function handleSubmit() {
    const name = form.name.trim();
    if (!name) {
      setError("Company name is required.");
      return;
    }

    // Reject names with excessive special characters
    if (!/^[a-zA-Z0-9\s&.,\-’'()]+$/.test(name)) {
      setError(
        "Invalid company name. Please use only standard characters (letters, numbers, spaces, and & . , - ' )."
      );
      return;
    }

    if (!/[a-zA-Z0-9]/.test(name)) {
      setError("Company name must contain at least one letter or number.");
      return;
    }

    const regNum = form.registration_number.trim();
    if (regNum) {
      // Must be exactly 12 digits, no letters
      if (!/^\d{12}$/.test(regNum)) {
        setError(
          "Company Registration Number must be exactly 12 digits. No letters or special characters allowed."
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/api/companies/", {
        name: form.name.trim(),
        industry: form.industry || null,
        registration_number: form.registration_number.trim() || null,
        description: form.description.trim() || null,
      });
      // Reset form and notify parent
      setForm({ name: "", industry: "", registration_number: "", description: "" });
      onCreated();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to create company. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Building2 size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add New Company</h2>
              <p className="text-xs text-gray-400">Register a new SME profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Company Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Lusaka Fresh Produce Ltd"
              className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Industry
            </label>
            <CustomSelect
              options={INDUSTRY_OPTIONS}
              value={form.industry}
              onChange={(val) => handleFieldChange("industry", val)}
              placeholder="Select industry…"
              themeColor="purple"
            />
          </div>

          {/* Registration Number */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Registration Number
            </label>
            <input
              name="registration_number"
              type="text"
              value={form.registration_number}
              onChange={handleChange}
              placeholder="e.g. 120240012345"
              className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description of the business…"
              className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              "Create Company"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
