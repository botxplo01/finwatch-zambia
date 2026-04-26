"use client";

/**
 * FinWatch Zambia - Company Detail Modal
 *
 * Modal for viewing and editing company details with tabs for
 * company information and prediction history.
 */

import { useState, useEffect } from "react";
import {
  X,
  Building2,
  Pencil,
  Trash2,
  History,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Calendar,
} from "lucide-react";
import api from "@/lib/api";
import { CustomSelect } from "@/components/ui/CustomSelect";

// Types

interface Company {
  id: number;
  name: string;
  industry: string | null;
  registration_number: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Prediction {
  id: number;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  predicted_at: string;
}

type Tab = "details" | "history";

interface Props {
  company: Company | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const INDUSTRIES = [
  "Agriculture", "Construction", "Education", "Financial Services",
  "Healthcare", "Hospitality & Tourism", "Manufacturing", "Mining",
  "Real Estate", "Retail & Trade", "Technology", "Transport & Logistics", "Other",
];

const INDUSTRY_OPTIONS = INDUSTRIES.map(ind => ({
  value: ind,
  label: ind
}));

// Helpers

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function riskBadge(prob: number, label: string) {
  if (prob >= 0.7)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
        <AlertTriangle size={9} /> {label}
      </span>
    );
  if (prob >= 0.4)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30">
      <CheckCircle2 size={9} /> {label}
    </span>
  );
}

// Component

export function CompanyDetailModal({ company, open, onClose, onUpdated, onDeleted }: Props) {
  const [tab, setTab]             = useState<Tab>("details");
  const [editing, setEditing]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]         = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    industry: "",
    registration_number: "",
    description: "",
  });

  // Populate form when company changes
  useEffect(() => {
    if (company) {
      setForm({
        name: company.name,
        industry: company.industry ?? "",
        registration_number: company.registration_number ?? "",
        description: company.description ?? "",
      });
      setEditing(false);
      setTab("details");
      setConfirmDelete(false);
      setError("");
    }
  }, [company]);

  // Load prediction history when switching to history tab
  useEffect(() => {
    if (tab === "history" && company) {
      loadHistory();
    }
  }, [tab, company]);

  if (!open || !company) return null;

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

  async function handleSave() {
    if (!company) return;
    const name = form.name.trim();
    if (!name) { setError("Company name is required."); return; }

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
      await api.patch(`/api/companies/${company.id}`, {
        name: form.name.trim(),
        industry: form.industry || null,
        registration_number: form.registration_number.trim() || null,
        description: form.description.trim() || null,
      });
      setEditing(false);
      onUpdated();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Update failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!company) return;
    setDeleting(true);
    try {
      await api.delete(`/api/companies/${company.id}`);
      onDeleted();
      onClose();
    } catch {
      setError("Delete failed. Please try again.");
      setDeleting(false);
    }
  }

  async function loadHistory() {
    if (!company) return;
    setHistoryLoading(true);
    try {
      // Fetch financial records, then gather predictions per record
      const recordsRes = await api.get(`/api/companies/${company.id}/records`);
      const records: any[] = recordsRes.data ?? [];

      const allPredictions: Prediction[] = [];
      await Promise.all(
        records.map(async (rec: any) => {
          try {
            const predRes = await api.get(`/api/predictions/?ratio_feature_id=${rec.ratio_feature?.id ?? 0}`);
            const preds: any[] = Array.isArray(predRes.data) ? predRes.data : predRes.data?.items ?? [];
            allPredictions.push(...preds);
          } catch {
            // record may have no predictions yet
          }
        })
      );

      // Sort by date desc
      allPredictions.sort(
        (a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime()
      );
      setPredictions(allPredictions);
    } catch {
      setPredictions([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
              <Building2 size={17} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{company.name}</h2>
              <p className="text-xs text-gray-400">
                {company.industry ?? "No industry set"} · Added {formatDate(company.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ml-2 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          {(["details", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {t === "details" ? <Building2 size={12} /> : <History size={12} />}
              {t === "details" ? "Details" : "Prediction History"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Details Tab */}
          {tab === "details" && (
            <div className="px-6 py-5 space-y-4">

              {/* Company Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Company Name {editing && <span className="text-red-500">*</span>}
                </label>
                {editing ? (
                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all"
                  />
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-900/50 px-3.5 py-2.5 rounded-xl">
                    {company.name}
                  </p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Industry</label>
                {editing ? (
                  <CustomSelect
                    options={INDUSTRY_OPTIONS}
                    value={form.industry}
                    onChange={(val) => handleFieldChange("industry", val)}
                    placeholder="Select industry…"
                    themeColor="purple"
                  />
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-900/50 px-3.5 py-2.5 rounded-xl">
                    {company.industry ?? <span className="text-gray-400">Not specified</span>}
                  </p>
                )}
              </div>

              {/* Registration Number */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Registration Number
                </label>
                {editing ? (
                  <input
                    name="registration_number"
                    type="text"
                    value={form.registration_number}
                    onChange={handleChange}
                    className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all"
                  />
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-900/50 px-3.5 py-2.5 rounded-xl">
                    {company.registration_number ?? <span className="text-gray-400">Not specified</span>}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                {editing ? (
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-zinc-900 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all resize-none"
                  />
                ) : (
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-900/50 px-3.5 py-2.5 rounded-xl min-h-[60px]">
                    {company.description ?? <span className="text-gray-400">No description</span>}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 px-3.5 py-2.5 rounded-xl">
                  {error}
                </p>
              )}

              {/* Delete confirmation */}
              {confirmDelete && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">Delete this company?</p>
                  <p className="text-xs text-red-500 dark:text-red-400/70 mb-3">
                    This will permanently remove all financial records, predictions, and reports. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="px-6 py-5">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-purple-400" />
                </div>
              ) : predictions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-900 flex items-center justify-center">
                    <TrendingUp size={18} className="text-gray-300 dark:text-gray-700" />
                  </div>
                  <p className="text-sm text-gray-400 text-center">
                    No predictions yet for this company.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {predictions.map((pred) => (
                    <div
                      key={pred.id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                          <TrendingUp size={13} className="text-purple-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            {riskBadge(pred.distress_probability, pred.risk_label)}
                            <span className="text-[10px] text-gray-400 font-medium uppercase">
                              {pred.model_used === "random_forest" ? "RF" : "LR"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar size={9} />
                            {formatDate(pred.predicted_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                          {Math.round(pred.distress_probability * 100)}%
                        </p>
                        <p className="text-[10px] text-gray-400">distress prob.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab === "details" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex-shrink-0">
            {/* Delete */}
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={confirmDelete || deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors disabled:opacity-40"
            >
              <Trash2 size={13} />
              Delete
            </button>

            {/* Edit / Save */}
            <div className="flex items-center gap-2">
              {editing && (
                <button
                  onClick={() => { setEditing(false); setError(""); }}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={editing ? handleSave : () => setEditing(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-sm"
                style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
              >
                {loading ? (
                  <><Loader2 size={13} className="animate-spin" /> Saving…</>
                ) : editing ? (
                  <><Save size={13} /> Save Changes</>
                ) : (
                  <><Pencil size={13} /> Edit</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
