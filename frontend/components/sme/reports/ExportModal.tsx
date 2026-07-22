"use client";

/**
 * FinWatch Zambia - SME Export Modal
 *
 * Modal for exporting dual-model assessments in PDF, CSV, or ZIP formats.
 * Supports assessment selection and format choice with download handling.
 * Calls /api/reports/assessment/{ratio_feature_id}* endpoints (Session 120).
 */

import { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  FileSpreadsheet,
  Archive,
  Download,
  Loader2,
  AlertTriangle,
  History,
  CheckCircle,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

interface Assessment {
  ratio_feature_id: number;
  company_id: number;
  company_name: string;
  period: string;
  assessment_methodology: string;
  random_forest_risk_label: string | null;
  random_forest_probability: number | null;
  logistic_regression_risk_label: string | null;
  logistic_regression_probability: number | null;
  models_agree: boolean | null;
  predicted_at: string;
}

type ExportFormat = "pdf" | "csv" | "zip";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  ratioFeatureId?: number;
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

function formatPct(prob: number) {
  return `${Math.round(prob * 100)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Resolve the primary model for display: RF first, LR as fallback.
 * Matches the pattern established in history/page.tsx (Session 114).
 */
function primaryRisk(a: Assessment) {
  return {
    label:
      a.random_forest_risk_label ?? a.logistic_regression_risk_label ?? "Unknown",
    prob: a.random_forest_probability ?? a.logistic_regression_probability ?? 0,
  };
}

// Main Modal

export function ExportModal({
  open,
  onClose,
  onCreated,
  ratioFeatureId,
}: ExportModalProps) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedRatioFeatureId, setSelectedRatioFeatureId] = useState<
    number | null
  >(ratioFeatureId ?? null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(
    null
  );
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const [savedLocation, setSavedLocation] = useState<string | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load assessments list
  useEffect(() => {
    if (!open) return;
    if (ratioFeatureId) {
      setSelectedRatioFeatureId(ratioFeatureId);
      return;
    }
    setLoadingAssessments(true);
    api
      .get("/api/predictions/", { params: { limit: 100 } })
      .then((res) => {
        const data = res.data;
        setAssessments(Array.isArray(data) ? data : data.items ?? []);
      })
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoadingAssessments(false));
  }, [open, ratioFeatureId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedFormat(null);
      setError("");
      setExporting(false);
      setSavedFilename(null);
      setSavedLocation(null);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      if (!ratioFeatureId) setSelectedRatioFeatureId(null);
    }
  }, [open, ratioFeatureId]);

  async function handleExport() {
    if (!selectedRatioFeatureId || !selectedFormat) return;
    setExporting(true);
    setError("");
    setSavedFilename(null);
    let exportedFilename: string | null = null;

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

    const headers = { "X-User-Time": userTime };

    const selectedAssessment = assessments.find(
      (a) => a.ratio_feature_id === selectedRatioFeatureId
    );
    const slug = selectedAssessment?.company_name
      ? selectedAssessment.company_name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s-]+/g, "_")
          .slice(0, 40)
      : "report";
    const period = selectedAssessment?.period || "unknown";
    const baseName = `finwatch_${slug}_${period}_${selectedRatioFeatureId}`;

    try {
      let location = "";

      // PDF: POST to generate (saves to DB), then GET to download
      if (selectedFormat === "pdf") {
        const genRes = await api.post(
          `/api/reports/assessment/${selectedRatioFeatureId}`,
          null,
          { headers }
        );
        const dlRes = await api.get(
          `/api/reports/assessment/${selectedRatioFeatureId}`,
          { headers, responseType: "blob" }
        );
        location = await triggerDownload(
          dlRes.data,
          genRes.data.filename,
          "application/pdf"
        );
        onCreated();
        exportedFilename = genRes.data.filename;
      }

      // CSV: GET stream directly
      if (selectedFormat === "csv") {
        const res = await api.get(
          `/api/reports/assessment/${selectedRatioFeatureId}/csv`,
          { responseType: "blob" }
        );
        const filename = extractFilename(res.headers, `${baseName}.csv`);
        location = await triggerDownload(res.data, filename, "text/csv");
        exportedFilename = filename;
      }

      // ZIP: GET stream directly
      if (selectedFormat === "zip") {
        const res = await api.get(
          `/api/reports/assessment/${selectedRatioFeatureId}/zip`,
          { headers, responseType: "blob" }
        );
        const filename = extractFilename(res.headers, `${baseName}.zip`);
        location = await triggerDownload(
          res.data,
          filename,
          "application/zip"
        );
        onCreated();
        exportedFilename = filename;
      }

      // Show confirmation banner with full filename, then auto-close
      setSavedFilename(exportedFilename);
      setSavedLocation(location);
      autoCloseRef.current = setTimeout(() => onClose(), 4000);
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
            : detail?.detail ?? "Export failed."
        );
      }
    } finally {
      setExporting(false);
    }
  }

  async function triggerDownload(
    data: Blob,
    filename: string,
    mimeType: string
  ): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = await blobToBase64(data);
        let savedUri = "";
        let location = "";

        try {
          // Check and request storage permissions
          const permissionStatus = await Filesystem.checkPermissions();
          if (permissionStatus.publicStorage !== "granted") {
            const requestStatus = await Filesystem.requestPermissions();
            if (requestStatus.publicStorage !== "granted") {
              throw new Error("Storage permission not granted");
            }
          }

          // Save to public Documents folder for persistent local copy
          const savedResult = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
          });
          savedUri = savedResult.uri;
          location = "Documents folder";
        } catch (documentsError) {
          console.warn("Could not save to Documents, falling back to Cache:", documentsError);
          // Fallback to app Cache directory
          const savedResult = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Cache,
          });
          savedUri = savedResult.uri;
          location = "App Cache folder";
        }

        // Trigger share sheet using the saved file's URI
        await Share.share({
          title: filename,
          url: savedUri,
          dialogTitle: `Save ${filename}`,
        });
        return location;
      } catch {
        // User cancelled the share sheet or a write error occurred.
        return "App Cache folder";
      }
    }
    const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "Downloads folder";
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function extractFilename(headers: any, fallback: string): string {
    const cd = headers["content-disposition"] ?? "";
    const match = cd.match(/filename="?([^"]+)"?/);
    return match ? match[1] : fallback;
  }

  const selectedAssessment = assessments.find(
    (a) => a.ratio_feature_id === selectedRatioFeatureId
  );
  const canExport = selectedRatioFeatureId !== null && selectedFormat !== null;

  const assessmentOptions = assessments.map((a) => {
    const risk = primaryRisk(a);
    const disagreement = a.models_agree === false ? " ⚠" : "";
    return {
      value: String(a.ratio_feature_id),
      label: `${a.company_name} — ${a.period} — ${risk.label} ${formatPct(risk.prob)}${disagreement}`,
    };
  });

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
              Choose an assessment and export format
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
          {/* Step 1: Select Assessment */}
          {!ratioFeatureId && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
                1. Select Assessment
              </label>
              {loadingAssessments ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Loading
                  assessments…
                </div>
              ) : assessments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-500 py-2">
                  No assessments found. Run an assessment first.
                </p>
              ) : (
                <CustomSelect
                  options={assessmentOptions}
                  value={
                    selectedRatioFeatureId
                      ? String(selectedRatioFeatureId)
                      : ""
                  }
                  onChange={(val) =>
                    setSelectedRatioFeatureId(Number(val))
                  }
                  placeholder="Select an assessment…"
                  icon={History}
                  themeColor="purple"
                />
              )}

              {/* Selected assessment summary */}
              {selectedAssessment && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 text-xs text-gray-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>
                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                      {selectedAssessment.company_name}
                    </span>
                    {" · "}
                    {selectedAssessment.period}
                    {" · "}
                    {formatDate(selectedAssessment.predicted_at)}
                    {selectedAssessment.models_agree === false && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={10} className="flex-shrink-0" />
                        Models disagree
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-semibold ${
                      primaryRisk(selectedAssessment).label === "Distressed"
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {formatPct(primaryRisk(selectedAssessment).prob)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
              {ratioFeatureId ? "1." : "2."} Choose Export Format
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
                      ${
                        isSelected
                          ? "border-purple-500"
                          : "border-gray-300 dark:border-zinc-600"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
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
                        {fmt.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export success confirmation */}
          {savedFilename && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3.5 py-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-emerald-700 dark:text-emerald-400 leading-snug">
                <span className="font-bold">{savedFilename}</span> exported successfully to <span className="font-semibold text-emerald-800 dark:text-emerald-300">{savedLocation}</span>.
              </span>
            </div>
          )}

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
            className={cn(
              "flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm",
              canExport
                ? "bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/10"
                : "bg-gray-300 dark:bg-zinc-700"
            )}
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
