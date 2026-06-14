"use client";

/**
 * FinWatch Zambia - Institutional Export Modal
 *
 * Modal for exporting anonymised aggregate institutional data in PDF, CSV,
 * JSON, or ZIP formats. Access restricted to full regulator role.
 */

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  FileJson,
  Archive,
  Download,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Info,
} from "lucide-react";
import api from "@/lib/api";
import { getInstitutionalAuthHeader, getInstitutionalUser } from "@/lib/institutional-auth";
import { cn } from "@/lib/utils";
import { useInstitutionalFilter } from "@/context/InstitutionalFilterContext";

type ExportFormat = "pdf" | "csv" | "json" | "zip";

interface InstitutionalExportModalProps {
  open: boolean;
  onClose: () => void;
  isFullRegulator: boolean;
  config: {
    includeAiSummary: boolean;
    maskEntities: boolean;
    includeModelAudit: boolean;
    includeRiskMatrix: boolean;
  };
}

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
    label: "PDF Regulator Report",
    sub: "Full multi-section report: system overview, sector breakdown, trends, model performance, ratio benchmarks, and anomaly flags.",
    icon: <FileText size={22} className="text-red-500" />,
    badge: ".pdf",
    badgeColor:
      "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800",
  },
  {
    id: "csv",
    label: "CSV Spreadsheet",
    sub: "Flat tabular export of all aggregate data, sectioned by overview, sectors, trends, model performance, ratio benchmarks, and flags.",
    icon: <FileSpreadsheet size={22} className="text-green-600" />,
    badge: ".csv",
    badgeColor:
      "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800",
  },
  {
    id: "json",
    label: "Structured JSON",
    sub: "Full prediction schema export — system overview, all aggregate sections, and anonymised flags as a structured JSON document.",
    icon: <FileJson size={22} className="text-blue-600" />,
    badge: ".json",
    badgeColor:
      "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800",
  },
  {
    id: "zip",
    label: "Bundled Archive",
    sub: "ZIP file containing the PDF report, CSV spreadsheet, and JSON document together in a single download.",
    icon: <Archive size={22} className="text-purple-600" />,
    badge: ".zip",
    badgeColor:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800",
  },
];

const ENDPOINT_MAP: Record<ExportFormat, string> = {
  pdf: "/api/institutional/export/pdf",
  csv: "/api/institutional/export/csv",
  json: "/api/institutional/export/json",
  zip: "/api/institutional/export/zip",
};

const MIME_MAP: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
};

export function InstitutionalExportModal({
  open,
  onClose,
  isFullRegulator,
  config,
}: InstitutionalExportModalProps) {
  const { selectedScales, selectedSectors } = useInstitutionalFilter();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("regulator");

  useEffect(() => {
    const user = getInstitutionalUser<{ role: string }>();
    if (user) setUserRole(user.role);
  }, []);

  const isAnalyst = userRole === "policy_analyst";

  const accentBase = isAnalyst ? "#2563eb" : "#059669";
  const accentLight = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";
  const iconColor = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";
  const borderActive = isAnalyst
    ? "border-blue-400 dark:border-blue-600 ring-blue-200 dark:ring-blue-800"
    : "border-emerald-400 dark:border-emerald-600 ring-emerald-200 dark:ring-emerald-800";
  const radioActive = isAnalyst ? "border-blue-500" : "border-emerald-500";
  const radioDot = isAnalyst ? "bg-blue-500" : "bg-emerald-500";
  const btnGradient = isAnalyst
    ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
    : "linear-gradient(135deg, #059669, #047857)";

  function handleClose() {
    if (exporting) return;
    setSelectedFormat(null);
    setError("");
    onClose();
  }

  async function handleExport() {
    if (!selectedFormat) return;
    setExporting(true);
    setError("");

    // Capture user local time for PDF header
    const userTime = new Date().toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });

    try {
      const res = await api.get(ENDPOINT_MAP[selectedFormat], {
        headers: {
          ...getInstitutionalAuthHeader(),
          "X-User-Time": userTime,
        },
        params: {
          include_ai_summary: config.includeAiSummary,
          mask_entities: config.maskEntities,
          scale: selectedScales.join(","),
          sector: selectedSectors.join(","),
        },
        responseType: "blob",
      });

      // Extract filename from Content-Disposition header
      const cd = res.headers["content-disposition"] ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const date = new Date().toISOString().slice(0, 10);
      const fallback =
        `finwatch_{slug}_export_${date}.${selectedFormat}`.replace(
          "{slug}",
          isAnalyst ? "analyst" : "regulator"
        );
      const filename = match ? match[1] : fallback;

      const url = URL.createObjectURL(
        new Blob([res.data], { type: MIME_MAP[selectedFormat] })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      handleClose();
    } catch (err: any) {
      const detail = err?.response?.data;
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
          typeof detail?.detail === "string"
            ? detail.detail
            : "Export failed. Please try again."
        );
      }
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-gray-50 dark:border-zinc-800"
          style={{ borderTopWidth: 3, borderTopColor: accentBase }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg ${accentLight} flex items-center justify-center transition-colors`}
            >
              <ShieldCheck size={16} className={iconColor} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                Regulator Data Export
              </h2>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                Anonymised aggregate data — no PII included
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Config Summary */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-inner">
            <div className="flex gap-4">
              <span
                className={cn(
                  config.includeAiSummary ? "text-purple-500" : "opacity-40"
                )}
              >
                AI Summary {config.includeAiSummary ? "ON" : "OFF"}
              </span>
              <span
                className={cn(
                  config.maskEntities ? "text-amber-500" : "opacity-40"
                )}
              >
                Anonymized {config.maskEntities ? "ON" : "OFF"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <ShieldCheck size={11} />
              <span>Scope Applied</span>
            </div>
          </div>

          <>
            {/* Privacy notice */}
            <div
              className={`flex items-start gap-2.5 ${
                isAnalyst
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
              } rounded-xl px-3.5 py-3 border transition-colors`}
            >
              <ShieldCheck
                size={13}
                className={iconColor}
                style={{ marginTop: "2px" }}
              />
              <p
                className={`text-[11px] ${
                  isAnalyst
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-emerald-700 dark:text-emerald-400"
                } leading-relaxed`}
              >
                {isAnalyst
                  ? "Policy Analyst exports contain system-wide performance trends and sectoral insights. Individual high-risk identifiers are suppressed for privacy."
                  : "All exports contain fully anonymised aggregate data only. No company names, user IDs, or personally identifiable information is included in any format."}
              </p>
            </div>

            {/* Format selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
                Select Export Format
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
                            ? `${borderActive} ${
                                isAnalyst
                                  ? "bg-blue-50/60 dark:bg-blue-900/20"
                                  : "bg-emerald-50/60 dark:bg-emerald-900/20"
                              }`
                            : "border-gray-100 dark:border-zinc-800 hover:border-gray-200 dark:hover:border-zinc-700 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50"
                        }`}
                    >
                      {/* Radio */}
                      <div
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                        ${
                          isSelected
                            ? radioActive
                            : "border-gray-300 dark:border-zinc-600"
                        }`}
                      >
                        {isSelected && (
                          <div className={`w-2 h-2 rounded-full ${radioDot}`} />
                        )}
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                        ${
                          isSelected
                            ? "bg-white dark:bg-zinc-900"
                            : "bg-gray-100 dark:bg-zinc-800"
                        }`}
                      >
                        {fmt.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-sm font-semibold ${
                              isSelected
                                ? "text-gray-900 dark:text-zinc-50"
                                : "text-gray-800 dark:text-zinc-200"
                            }`}
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
                          {isAnalyst && fmt.id === "pdf"
                            ? "Aggregated multi-section report focusing on sector-wide synthesis and temporal trends."
                            : fmt.sub}
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
          </>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60 dark:bg-zinc-800/40 border-t border-gray-50 dark:border-zinc-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedFormat || exporting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 shadow-sm"
            style={{
              background:
                selectedFormat && !exporting ? btnGradient : undefined,
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
                Export
                {selectedFormat ? ` ${selectedFormat.toUpperCase()}` : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
