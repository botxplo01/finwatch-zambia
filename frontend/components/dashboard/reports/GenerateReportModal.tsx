"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Search,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface PredictionOption {
  id:                   number;
  company_name:         string;
  period:               string;
  model_used:           string;
  risk_label:           string;
  distress_probability: number;
  predicted_at:         string;
}

interface Props {
  open:      boolean;
  onClose:   () => void;
  onCreated: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function RiskChip({ prob }: { prob: number }) {
  const tier =
    prob >= 0.7 ? "high" :
    prob >= 0.4 ? "medium" : "healthy";
  const styles = {
    high:    "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    medium:  "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    healthy: "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[tier]}`}>
      {Math.round(prob * 100)}%
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function GenerateReportModal({ open, onClose, onCreated }: Props) {
  const [predictions, setPredictions] = useState<PredictionOption[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [selected,    setSelected]    = useState<number | null>(null);
  const [search,      setSearch]      = useState("");
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setError("");
    setSuccess("");
    setSearch("");

    setLoading(true);
    api.get("/api/predictions/?limit=200")
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : r.data?.items ?? [];
        setPredictions(items);
      })
      .catch(() => setError("Failed to load predictions."))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = search.trim()
    ? predictions.filter(
        (p) =>
          p.company_name.toLowerCase().includes(search.toLowerCase()) ||
          p.period.toLowerCase().includes(search.toLowerCase())
      )
    : predictions;

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      await api.post(`/api/reports/${selected}`);
      setSuccess("Report generated successfully.");
      onCreated();
      setTimeout(() => {
        onClose();
        setSuccess("");
      }, 1200);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? "";

      if (status === 503) {
        setError("PDF generation is not yet active. Run the training pipeline and ensure ReportLab is installed.");
      } else if (status === 201 || detail.toLowerCase().includes("already exists")) {
        setSuccess("Report already exists — refreshing list.");
        onCreated();
        setTimeout(onClose, 1000);
      } else {
        setError(typeof detail === "string" ? detail : "Failed to generate report.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Generate Report</h2>
              <p className="text-xs text-gray-400 dark:text-zinc-500">Select a prediction to export as PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company or period…"
              className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-purple-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <TrendingUp size={24} className="text-gray-200 dark:text-zinc-700" />
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                {predictions.length === 0
                  ? "No predictions available. Run a prediction first."
                  : `No results for "${search}"`}
              </p>
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 ${
                  selected === p.id
                    ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700"
                    : "border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Building2 size={13} className="text-gray-500 dark:text-zinc-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${
                      selected === p.id ? "text-purple-700 dark:text-purple-300" : "text-gray-800 dark:text-zinc-100"
                    }`}>
                      {p.company_name}
                    </p>
                    <RiskChip prob={p.distress_probability} />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                    {p.period} · {p.model_used === "random_forest" ? "RF" : "LR"} · {formatDate(p.predicted_at)}
                  </p>
                </div>

                {/* Selected check */}
                {selected === p.id && (
                  <CheckCircle2 size={15} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Feedback */}
        <div className="px-6 flex-shrink-0">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3.5 py-2.5 rounded-xl mb-3">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-3.5 py-2.5 rounded-xl mb-3">
              <CheckCircle2 size={14} /> {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!selected || generating}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
          >
            {generating ? (
              <><Loader2 size={13} className="animate-spin" /> Generating…</>
            ) : (
              <><FileText size={13} /> Generate PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
