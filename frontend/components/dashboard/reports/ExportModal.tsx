"use client";

/**
 * FinWatch Zambia - SME Export Modal
 *
 * Modal for exporting prediction assessments in PDF, CSV, or ZIP formats.
 * Supports prediction selection and format choice with download handling.
 */

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  Archive,
  Download,
  Loader2,
  AlertTriangle,
  History,
} from "lucide-react";
import api from "@/lib/api";
import { CustomSelect } from "@/components/ui/CustomSelect";

// Types

interface Prediction {
  id: number;
  company_name: string;
  period: string;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  predicted_at: string;
}

type ExportFormat = "pdf" | "csv" | "zip";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** If provided, skips the prediction selector step */
  predictionId?: number;
}

// Format Options

const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  sub: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
}[] = [
  {
    id: "pdf",
    label: "PDF Report",
    sub: "Full assessment with ratios, SHAP chart, and AI narrative. Best for sharing and printing.",
    icon: <FileText size={22} className="text-red-500" />,
    badge: ".pdf",
    badgeColor:
      "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800",
  },
  {
    id: "csv",
    label: "CSV Spreadsheet",
    sub: "Structured data export with all ratios, SHAP values, and narrative. Best for analysis in Excel.",
    icon: <FileSpreadsheet size={22} className="text-green-600" />,
    badge: ".csv",
    badgeColor:
      "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800",
  },
  {
    id: "zip",
    label: "Bundled Export",
    sub: "ZIP archive containing both the PDF report and CSV file together in one download.",
    icon: <Archive size={22} className="text-purple-600" />,
    badge: ".zip",
    badgeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800",
  },
];

// Helpers

function formatPct(prob: number) {
  return `${Math.round(prob * 100)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Main Modal

export function ExportModal({
  open,
  onClose,
  onCreated,
  predictionId,
}: ExportModalProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedPredId, setSelectedPredId] = useState<number | null>(
    predictionId ?? null,
  );
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(
    null,
  );
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // Load predictions list (only if no predictionId prop)
  useEffect(() => {
    if (!open) return;
    if (predictionId) {
      setSelectedPredId(predictionId);
      return;
    }
    setLoadingPreds(true);
    api
      .get("/api/predictions/", { params: { limit: 100 } })
      .then((res) => {
        const data = res.data;
        setPredictions(Array.isArray(data) ? data : (data.items ?? []));
      })
      .catch(() => setError("Failed to load predictions."))
      .finally(() => setLoadingPreds(false));
  }, [open, predictionId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedFormat(null);
      setError("");
      setExporting(false);
      if (!predictionId) setSelectedPredId(null);
    }
  }, [open, predictionId]);

  async function handleExport() {
    if (!selectedPredId || !selectedFormat) return;
    setExporting(true);
    setError("");

    try {
      // PDF: POST to generate (saves to DB), then GET to download
      if (selectedFormat === "pdf") {
        const genRes = await api.post(`/api/reports/${selectedPredId}`);
        const dlRes = await api.get(`/api/reports/${selectedPredId}`, {
          responseType: "blob",
        });
        triggerDownload(dlRes.data, genRes.data.filename, "application/pdf");
        onCreated();
      }

      // CSV: GET stream directly
      if (selectedFormat === "csv") {
        const res = await api.get(`/api/reports/${selectedPredId}/csv`, {
          responseType: "blob",
        });
        const filename = extractFilename(
          res.headers,
          `finwatch_report_${selectedPredId}.csv`,
        );
        triggerDownload(res.data, filename, "text/csv");
      }

      // ZIP: GET stream directly
      if (selectedFormat === "zip") {
        const res = await api.get(`/api/reports/${selectedPredId}/zip`, {
          responseType: "blob",
        });
        const filename = extractFilename(
          res.headers,
          `finwatch_bundle_${selectedPredId}.zip`,
        );
        triggerDownload(res.data, filename, "application/zip");
        onCreated(); // ZIP includes PDF, so refresh report list
      }

      onClose();
    } catch (err: any) {
      const detail = err?.response?.data;
      // Blob error responses need to be parsed
      if (detail instanceof Blob) {
        const text = await detail.text();
        try {
          const parsed = JSON.parse(text);
          setError(parsed.detail ?? "Export failed.");
        } catch {
          setError("Export failed. Please try again.");
        }
      } else {
        setError(
          typeof detail === "string"
            ? detail
            : (detail?.detail ?? "Export failed."),
        );
      }
    } finally {
      setExporting(false);
    }
  }

  function triggerDownload(data: Blob, filename: string, mimeType: string) {
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function extractFilename(headers: any, fallback: string): string {
    const cd = headers["content-disposition"] ?? "";
    const match = cd.match(/filename="?([^"]+)"?/);
    return match ? match[1] : fallback;
  }

  const selectedPred = predictions.find((p) => p.id === selectedPredId);
  const canExport = selectedPredId !== null && selectedFormat !== null;

  const predOptions = predictions.map((p) => ({
    value: String(p.id),
    label: `${p.company_name} — ${p.period} — ${p.model_used === "random_forest" ? "RF" : "LR"} — ${formatPct(p.distress_probability)}`,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
              Export Assessment
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              Choose a prediction and export format
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Step 1: Select Prediction */}
          {!predictionId && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
                1. Select Prediction
              </label>
              {loadingPreds ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Loading
                  predictions…
                </div>
              ) : predictions.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-500 py-2">
                  No predictions found. Run an assessment first.
                </p>
              ) : (
                <CustomSelect
                  options={predOptions}
                  value={selectedPredId ? String(selectedPredId) : ""}
                  onChange={(val) => setSelectedPredId(Number(val))}
                  placeholder="Select a prediction…"
                  icon={History}
                  themeColor="purple"
                />
              )}

              {/* Selected prediction summary */}
              {selectedPred && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-xs text-gray-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>
                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                      {selectedPred.company_name}
                    </span>
                    {" · "}
                    {selectedPred.period}
                    {" · "}
                    {formatDate(selectedPred.predicted_at)}
                  </span>
                  <span
                    className={`font-semibold ${selectedPred.risk_label === "Distressed" ? "text-red-500" : "text-green-600"}`}
                  >
                    {formatPct(selectedPred.distress_probability)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
              {predictionId ? "1." : "2."} Choose Export Format
            </label>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all text-left
                      ${
                        isSelected
                          ? "border-purple-400 dark:border-purple-600 bg-purple-50/60 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-800"
                          : "border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50"
                      }`}
                  >
                    {/* Radio indicator */}
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                      ${isSelected ? "border-purple-500" : "border-gray-300 dark:border-zinc-600"}`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                      ${isSelected ? "bg-white dark:bg-zinc-900" : "bg-gray-100 dark:bg-zinc-800"}`}
                    >
                      {fmt.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-sm font-semibold ${isSelected ? "text-gray-900 dark:text-zinc-50" : "text-gray-800 dark:text-zinc-200"}`}
                        >
                          {fmt.label}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${fmt.badgeColor}`}
                        >
                          {fmt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-snug">
                        {fmt.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3 py-2.5 rounded-xl">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60 dark:bg-zinc-800/40 border-t border-gray-50 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport || exporting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 shadow-sm"
            style={{
              background: canExport
                ? "linear-gradient(135deg, #6d28d9, #4c1d95)"
                : undefined,
            }}
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download size={14} />
                Export{selectedFormat ? ` ${selectedFormat.toUpperCase()}` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
