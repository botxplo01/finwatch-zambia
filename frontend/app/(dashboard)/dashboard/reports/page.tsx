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
} from "lucide-react";
import api from "@/lib/api";
import { ExportModal } from "@/components/dashboard/reports/ExportModal";

// Types

interface ReportItem {
  report_id: number;
  prediction_id: number;
  company_name: string;
  filename: string;
  generated_at: string;
}

// Helpers

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Extract period from filename: finwatch_{company}_{period}_{id}.{ext}
function extractPeriod(filename: string): string {
  const parts = filename.replace(/\.(pdf|csv|zip)$/, "").split("_");
  if (parts.length >= 4) return parts[parts.length - 2];
  return "—";
}

// Report Card (mobile)

function ReportCard({
  report,
  onExport,
}: {
  report: ReportItem;
  onExport: (id: number) => void;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
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
          <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
            {report.filename}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <div>
          <p className="text-gray-400 dark:text-zinc-500">Period</p>
          <p className="font-mono font-medium text-gray-700 dark:text-zinc-300 mt-0.5">
            {extractPeriod(report.filename)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-zinc-500">Generated</p>
          <p className="font-medium text-gray-700 dark:text-zinc-300 mt-0.5">
            {formatDate(report.generated_at)}
          </p>
        </div>
      </div>
      <button
        onClick={() => onExport(report.prediction_id)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <Upload size={14} /> Export
      </button>
    </div>
  );
}

// Page

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [exportPredId, setExportPredId] = useState<number | undefined>(
    undefined,
  );
  const [dlError, setDlError] = useState("");

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

  function openNewExport() {
    setExportPredId(undefined);
    setModalOpen(true);
  }

  function openExportForPrediction(predictionId: number) {
    setExportPredId(predictionId);
    setModalOpen(true);
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
      <div className="p-6 pb-20 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              Reports
            </h1>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
              {loading
                ? "Loading…"
                : `${reports.length} PDF report${reports.length !== 1 ? "s" : ""} generated`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReports}
              disabled={loading}
              aria-label="Refresh"
              className="p-2 rounded-xl text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={openNewExport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-sm flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Search */}
        {reports.length > 0 && (
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name or filename…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-600"
            />
          </div>
        )}

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
          <div className="flex flex-col items-center gap-4 py-20 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <FileText size={24} className="text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                No reports yet
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs">
                Export a PDF, CSV, or bundled archive from any completed
                prediction. Reports include ratios, SHAP attributions, and the
                AI narrative.
              </p>
            </div>
            <button
              onClick={openNewExport}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
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
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                    {["Company", "Period", "Filename", "Generated", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {filtered.map((report) => (
                    <tr
                      key={report.report_id}
                      className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                            <Building2 size={12} className="text-purple-500" />
                          </div>
                          <span className="font-medium text-gray-800 dark:text-zinc-100 truncate max-w-[160px]">
                            {report.company_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono font-medium text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 px-2 py-0.5 rounded-md">
                          {extractPeriod(report.filename)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <FileText
                            size={12}
                            className="text-gray-400 dark:text-zinc-500 flex-shrink-0"
                          />
                          <span className="text-xs text-gray-500 dark:text-zinc-400 font-mono truncate max-w-[200px]">
                            {report.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
                          <Calendar size={11} />
                          {formatDateTime(report.generated_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() =>
                            openExportForPrediction(report.prediction_id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        >
                          <Download size={11} /> Export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {filtered.length} of {reports.length} report
                  {reports.length !== 1 ? "s" : ""}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-xs text-purple-600 font-medium hover:underline"
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
                  onExport={openExportForPrediction}
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
        predictionId={exportPredId}
      />
    </>
  );
}
