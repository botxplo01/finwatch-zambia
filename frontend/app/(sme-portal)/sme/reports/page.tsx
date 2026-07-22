"use client";

/**
 * FinWatch Zambia - SME Reports
 *
 * Manage generated PDF reports with search, filtering,
 * and export functionality for completed predictions.
 */

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Download,
  Loader2,
  AlertTriangle,
  Search,
  Building2,
  Calendar,
  RefreshCw,
  Trash2,
  Upload,
  X,
  Eye,
} from "lucide-react";
import api from "@/lib/api";
import { ExportModal } from "@/components/sme/reports/ExportModal";
import { PredictionReportPreview } from "@/components/sme/reports/PredictionReportPreview";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

interface ReportItem {
  report_id: number;
  prediction_id: number;
  ratio_feature_id: number;
  company_name: string;
  filename: string;
  generated_at: string;
}

/**
 * Extract reporting period from deterministic filename.
 * Format: finwatch_{company}_{period}_{id}.{ext}
 */
function extractPeriod(filename: string): string {
  const parts = filename.replace(/\.(pdf|csv|zip)$/, "").split("_");
  if (parts.length >= 4) return parts[parts.length - 2];
  return "—";
}

/**
 * Mobile-optimised card display for a single report item.
 */
function ReportCard({
  report,
  onExport,
  onPreview,
  onClear,
  clearingId,
  setClearingId,
}: {
  report: ReportItem;
  onExport: (ratioFeatureId: number) => void;
  onPreview: (ratioFeatureId: number) => void;
  onClear: (id: number) => void;
  clearingId: number | null;
  setClearingId: (id: number | null) => void;
}) {
  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
          <FileText
            size={18}
            className="text-purple-600 dark:text-purple-400"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm truncate">
            {report.company_name}
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 font-bold tracking-tight">
            Prediction #{report.prediction_id}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <div>
          <p className="text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-tighter text-[10px]">
            Period
          </p>
          <p className="font-mono font-medium text-gray-700 dark:text-zinc-300 mt-0.5">
            {extractPeriod(report.filename)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-tighter text-[10px]">
            Generated
          </p>
          <p className="font-medium text-gray-700 dark:text-zinc-300 mt-0.5">
            {formatDate(report.generated_at)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onPreview(report.ratio_feature_id)}
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <Eye size={13} /> Preview
        </button>
        <button
          onClick={() => onExport(report.ratio_feature_id)}
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
        >
          <Upload size={13} /> Export
        </button>
        <button
          onClick={() => setClearingId(report.report_id)}
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {/* Confirmation Overlay */}
      {clearingId === report.report_id && (
        <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 flex flex-col items-center justify-center gap-3 z-20 animate-in fade-in duration-200">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest">
            Clear history entry?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onClear(report.report_id)}
              className="px-6 py-2 rounded-xl bg-red-600 text-white text-[10px] font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => setClearingId(null)}
              className="px-6 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-[10px] font-bold active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SME Reports Page
 *
 * Lists all generated assessment reports for the user's companies.
 * Supports searching by company name and triggering new exports.
 */
export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [exportRatioFeatureId, setExportRatioFeatureId] = useState<
    number | undefined
  >(undefined);
  const [dlError, setDlError] = useState("");
  const [previewModal, setPreviewModal] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clearingId, setClearingId] = useState<number | null>(null);

  async function fetchReports() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/reports/");
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Failed to load reports. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  const handleClear = async (reportId: number) => {
    try {
      await api.delete(`/api/reports/${reportId}`);
      await fetchReports();
      setClearingId(null);
    } catch (err) {
      console.error("Failed to clear report entry:", err);
      setDlError("Failed to clear history entry.");
    }
  };

  function openNewExport() {
    setExportRatioFeatureId(undefined);
    setModalOpen(true);
  }

  function openExportForAssessment(ratioFeatureId: number) {
    setExportRatioFeatureId(ratioFeatureId);
    setModalOpen(true);
  }

  async function handleOpenPreview(ratioFeatureId: number) {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/api/predictions/assessment/${ratioFeatureId}`);
      setPreviewModal(res.data);
    } catch (err) {
      console.error("Failed to load assessment for preview", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter(
      (r) =>
        r.company_name.toLowerCase().includes(q) ||
        r.filename.toLowerCase().includes(q),
    );
  }, [reports, search]);

  return (
    <>
      <div className="px-6 pb-20 max-w-screen-2xl mx-auto">
        <div className="sticky top-0 z-20 -mx-6 px-6 py-6 mb-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl border-b border-white/20 dark:border-white/10 transition-all duration-300">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                  <FileText
                    size={20}
                    className="text-purple-600 dark:text-purple-400"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    Reports
                  </h1>
                  <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 leading-none">
                    Manage and export your assessment reports
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchReports}
                  disabled={loading}
                  className="flex items-center gap-2 p-2.5 md:px-4 md:py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-sm shadow-sm"
                >
                  <RefreshCw
                    className={cn(
                      "w-4 h-4 text-purple-500",
                      loading && "animate-spin",
                    )}
                  />
                  <span className="hidden md:inline">Reload</span>
                </button>
                <button
                  onClick={openNewExport}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:bg-purple-700 active:scale-[0.98] shadow-lg shadow-purple-600/10 flex-shrink-0 bg-purple-600"
                >
                  <Download size={15} />
                  <span className="hidden sm:inline">Export Report</span>
                </button>
              </div>
            </div>

            {/* Search and Stats Grid */}
            {reports.length > 0 && (
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by company name or filename…"
                    className="w-full h-12 pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-600"
                  />
                </div>

                {/* Stats strip */}
                {!loading && (
                  <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200/50 dark:border-purple-800/30 rounded-xl px-4 py-2 flex items-center gap-3 min-w-0 w-full md:max-w-[240px] shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center flex-shrink-0">
                      <FileText
                        size={16}
                        className="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-purple-700 dark:text-purple-100 truncate leading-none mb-0.5">
                        {reports.length}
                      </p>
                      <p className="text-[10px] text-purple-600/70 dark:text-purple-400/60 uppercase font-bold tracking-tight truncate leading-none">
                        Total Reports
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Download error */}
        {dlError && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-4 py-3 rounded-xl">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{dlError}</span>
            <button onClick={() => setDlError("")} className="ml-auto">
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        )}

        {/* Fetch error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle size={28} className="text-red-300" />
            <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
            <button
              onClick={fetchReports}
              className="text-xs text-purple-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <FileText size={24} className="text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                No reports yet
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                Export a PDF, CSV, or bundled archive report from any completed
                prediction.
              </p>
            </div>
            <button
              onClick={openNewExport}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg shadow-purple-600/10 hover:bg-purple-700 active:scale-[0.98] transition-all bg-purple-600"
            >
              <Plus size={15} /> Export your first report
            </button>
          </div>
        )}

        {/* No search results */}
        {!loading && !error && reports.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Search size={24} className="text-gray-300 dark:text-zinc-600" />
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              No reports match &ldquo;{search}&rdquo;
            </p>
            <button
              onClick={() => setSearch("")}
              className="text-xs text-purple-600 font-medium hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Desktop table */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden md:block rounded-2xl border border-white/20 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-none">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/60">
                    {[
                      "Company",
                      "Period",
                      "Prediction ID",
                      "Generated",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((report) => (
                    <tr
                      key={report.report_id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                    >
                      <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <Building2 size={12} className="text-purple-500" />
                          </div>
                          <span className="truncate max-w-[160px]">
                            {report.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono font-medium text-gray-600 dark:text-zinc-300 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100/50 dark:border-zinc-700/50 px-2 py-0.5 rounded-md">
                          {extractPeriod(report.filename)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 italic">
                              #
                            </span>
                          </div>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono font-bold tracking-tight">
                            {report.prediction_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-bold leading-tight">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} className="opacity-70" />
                          {formatDateTime(report.generated_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 relative">
                          <button
                            onClick={() =>
                              handleOpenPreview(report.ratio_feature_id)
                            }
                            disabled={clearingId !== null}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-all uppercase tracking-tighter disabled:opacity-50"
                          >
                            <Eye size={11} /> Preview
                          </button>
                          <button
                            onClick={() =>
                              openExportForAssessment(report.ratio_feature_id)
                            }
                            disabled={clearingId !== null}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 transition-all uppercase tracking-tighter disabled:opacity-50"
                          >
                            <Download size={11} /> Export
                          </button>
                          <button
                            onClick={() => setClearingId(report.report_id)}
                            disabled={clearingId !== null}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition-all uppercase tracking-tighter disabled:opacity-50"
                          >
                            <Trash2 size={11} /> Clear
                          </button>

                          {/* Confirmation Overlay */}
                          {clearingId === report.report_id && (
                            <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-center gap-2 rounded-lg z-10 animate-in fade-in duration-200">
                              <span className="text-[10px] font-extrabold text-red-500 uppercase">
                                Confirm?
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleClear(report.report_id)}
                                  className="px-2 py-1 rounded bg-red-600 text-white text-[9px] font-bold"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setClearingId(null)}
                                  className="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 text-[9px] font-bold"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white/50 dark:bg-transparent">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  {filtered.length} of {reports.length} report
                  {reports.length !== 1 ? "s" : ""}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filtered.map((report) => (
                <ReportCard
                  key={report.report_id}
                  report={report}
                  onExport={openExportForAssessment}
                  onPreview={handleOpenPreview}
                  onClear={handleClear}
                  clearingId={clearingId}
                  setClearingId={setClearingId}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchReports}
        ratioFeatureId={exportRatioFeatureId}
      />

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewModal(null)}
          />
          <div className="relative w-full max-w-4xl max-h-full flex flex-col animate-in zoom-in-95 duration-500">
            <div className="overflow-hidden rounded-3xl h-full shadow-2xl">
              <PredictionReportPreview
                assessment={previewModal}
                onClose={() => setPreviewModal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Loading Overlay */}
      {previewLoading && (
        <div className="fixed inset-0 z-[120] bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-white/20">
            <Loader2 size={32} className="text-purple-600 animate-spin" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Preparing Report Preview...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
