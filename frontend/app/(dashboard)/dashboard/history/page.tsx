"use client";

/**
 * FinWatch Zambia - SME Prediction History
 *
 * Browse and manage past financial distress assessments with
 * filtering, search, pagination, and detailed view modal.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  History,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Loader2,
  AlertTriangle,
  InboxIcon,
  Cpu,
  Eye,
  X,
  Calendar,
  Check,
  Building,
} from "lucide-react";
import api from "@/lib/api";
import PredictionDetailModal from "@/components/dashboard/history/PredictionDetailModal";
import { cn } from "@/lib/utils";

// Types

interface Company {
  id: number;
  name: string;
}

interface PredictionSummary {
  id: number;
  company_id: number;
  company_name: string;
  period: string;
  model_used: string;
  distress_probability: number;
  risk_label: string;
  predicted_at: string;
}

interface PaginatedPredictions {
  items: PredictionSummary[];
  total: number;
  skip: number;
  limit: number;
}

interface ModalTarget {
  id: number;
  companyName: string;
  period: string;
}

interface FilterState {
  model: string;
  risk: string;
  status: string;
  startDate: string;
  endDate: string;
  companyId: string;
}

// Constants

const PAGE_SIZE = 10;

const MODEL_OPTIONS = [
  { value: "", label: "All Models" },
  { value: "random_forest", label: "Random Forest" },
  { value: "logistic_regression", label: "Logistic Regression" },
];

const RISK_OPTIONS = [
  { value: "", label: "All Risks" },
  { value: "high", label: "High Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "low", label: "Low Risk" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Distressed", label: "Distressed" },
  { value: "Healthy", label: "Healthy" },
];

// Helpers

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RiskLevel = "High" | "Medium" | "Low";

function getRiskLevel(prob: number): RiskLevel {
  if (prob >= 0.7) return "High";
  if (prob >= 0.4) return "Medium";
  return "Low";
}

const RISK_STYLES: Record<RiskLevel, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function RiskBadge({ prob }: { prob: number }) {
  const level = getRiskLevel(prob);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${RISK_STYLES[level]}`}
    >
      {level} Risk
    </span>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isDistressed = label === "Distressed";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isDistressed
          ? "text-red-600 dark:text-red-400"
          : "text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {isDistressed ? (
        <TrendingDown className="w-3.5 h-3.5" />
      ) : (
        <TrendingUp className="w-3.5 h-3.5" />
      )}
      {isDistressed ? "Distressed" : "Healthy"}
    </span>
  );
}

// Page

export default function HistoryPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [predictions, setPredictions] = useState<PredictionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    model: "",
    risk: "",
    status: "",
    startDate: "",
    endDate: "",
    companyId: "",
  });

  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [tempFilters, setFiltersDraft] = useState<FilterState>(filters);
  
  const filterCardRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalTarget | null>(null);

  // Click outside to close desktop filters
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterCardRef.current && !filterCardRef.current.contains(event.target as Node)) {
        setDesktopFiltersOpen(false);
      }
    }
    if (desktopFiltersOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [desktopFiltersOpen]);

  useEffect(() => {
    api
      .get<Company[]>("/api/companies/")
      .then((r) => setCompanies(r.data))
      .catch(() => {});
  }, []);

  const fetchPredictions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      
      if (filters.companyId) params.company_id = filters.companyId;
      if (filters.model) params.model_name = filters.model;
      if (filters.risk) params.risk_level = filters.risk;
      if (filters.status) params.status_label = filters.status;
      if (filters.startDate) params.start_date = new Date(filters.startDate).toISOString();
      if (filters.endDate) params.end_date = new Date(filters.endDate).toISOString();

      const res = await api.get<PaginatedPredictions>("/api/predictions/", {
        params,
      });
      setPredictions(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError("Failed to load prediction history.");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const resetPageAndFetch = (newFilters: FilterState) => {
    setPage(0);
    setFilters(newFilters);
  };

  const clearFilters = () => {
    const fresh = {
      model: "",
      risk: "",
      status: "",
      startDate: "",
      endDate: "",
      companyId: "",
    };
    setFilters(fresh);
    setFiltersDraft(fresh);
    setPage(0);
  };

  const removeFilter = (key: keyof FilterState) => {
    const updated = { ...filters, [key]: "" };
    setFilters(updated);
    setFiltersDraft(updated);
    setPage(0);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const filtered = search.trim()
    ? predictions.filter(
        (p) =>
          p.company_name.toLowerCase().includes(search.toLowerCase()) ||
          p.period.toLowerCase().includes(search.toLowerCase()),
      )
    : predictions;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="px-6 pb-20 max-w-screen-2xl mx-auto">
        <div className="sticky top-0 z-20 -mx-6 px-6 py-6 mb-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl border-b border-white/20 dark:border-white/10 transition-all duration-300">
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                Prediction History
              </h1>
              <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 leading-none">
                Browse and manage your past business health assessments
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters Container */}
        <div className="relative space-y-4">
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-2xl shadow-sm">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search history…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
            </div>

            {/* Filter Trigger - Desktop */}
            <button
              onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
              className={cn(
                "hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all",
                hasActiveFilters
                  ? "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/20 dark:border-orange-900/40 dark:text-orange-400"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
              )}
            >
              <Filter size={16} />
              Filters
            </button>

            {/* Filter Trigger - Mobile */}
            <button
              onClick={() => {
                setFiltersDraft(filters);
                setMobileFiltersOpen(true);
              }}
              className={cn(
                "md:hidden p-2.5 rounded-xl border transition-all",
                hasActiveFilters
                  ? "bg-orange-50 border-orange-200 text-orange-600"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
              )}
            >
              <Filter size={20} />
            </button>
          </div>

          {/* Desktop Filter Card */}
          {desktopFiltersOpen && (
            <div
              ref={filterCardRef}
              className={cn(
                "absolute top-full left-0 right-0 mt-2 z-20 p-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-3xl border shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200",
                hasActiveFilters ? "border-orange-200 dark:border-orange-900/40" : "border-white/20 dark:border-white/10"
              )}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Model & Company */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Model Selection</label>
                    <div className="flex flex-col gap-1.5">
                      {MODEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => resetPageAndFetch({ ...filters, model: opt.value })}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all",
                            filters.model === opt.value
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 font-bold"
                              : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          )}
                        >
                          {opt.label}
                          {filters.model === opt.value && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Company</label>
                    <select
                      value={filters.companyId}
                      onChange={(e) => resetPageAndFetch({ ...filters, companyId: e.target.value })}
                      className="w-full h-11 bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700 rounded-xl px-3 text-sm outline-none focus:border-purple-500"
                    >
                      <option value="">All Companies</option>
                      {companies.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Risk & Status */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Risk Level</label>
                    <div className="grid grid-cols-2 gap-2">
                      {RISK_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => resetPageAndFetch({ ...filters, risk: opt.value })}
                          className={cn(
                            "px-3 py-2 rounded-xl text-xs transition-all border",
                            filters.risk === opt.value
                              ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-900/40 dark:text-orange-400 font-bold"
                              : "border-gray-100 dark:border-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Outcome Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => resetPageAndFetch({ ...filters, status: opt.value })}
                          className={cn(
                            "px-3 py-2 rounded-xl text-xs transition-all border",
                            filters.status === opt.value
                              ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800/40 dark:text-purple-300 font-bold"
                              : "border-gray-100 dark:border-zinc-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Date Period</label>
                  <div className="space-y-3 bg-gray-50/50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/60">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 ml-1">From</span>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => resetPageAndFetch({ ...filters, startDate: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 ml-1">To</span>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => resetPageAndFetch({ ...filters, endDate: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 pt-6 border-t border-gray-50 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={clearFilters}
                  className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear All Filters
                </button>
                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500/60 uppercase tracking-widest italic">
                  <Check size={12} /> Live Updates Active
                </div>
              </div>
            </div>
          )}

          {/* Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 px-1">
              {filters.model && (
                <button
                  onClick={() => removeFilter("model")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  <X size={10} />
                  Model: {MODEL_OPTIONS.find(o => o.value === filters.model)?.label}
                </button>
              )}
              {filters.risk && (
                <button
                  onClick={() => removeFilter("risk")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  <X size={10} />
                  Risk: {RISK_OPTIONS.find(o => o.value === filters.risk)?.label}
                </button>
              )}
              {filters.status && (
                <button
                  onClick={() => removeFilter("status")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  <X size={10} />
                  Status: {filters.status}
                </button>
              )}
              {filters.companyId && (
                <button
                  onClick={() => removeFilter("companyId")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  <X size={10} />
                  Company: {companies.find(c => String(c.id) === filters.companyId)?.name}
                </button>
              )}
              {(filters.startDate || filters.endDate) && (
                <button
                  onClick={() => {
                    const upd = { ...filters, startDate: "", endDate: "" };
                    setFilters(upd);
                    setFiltersDraft(upd);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-200 hover:text-red-500 transition-all"
                >
                  <X size={10} />
                  Date: {filters.startDate || "Any"} to {filters.endDate || "Now"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        {!loading && !error && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold px-1">
            Showing {filtered.length} of {total} predictions
          </p>
        )}
        </div>
        </div>

        {/* Content */}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Refreshing history…
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 mb-6">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={fetchPredictions}
                className="mt-2 text-xs underline underline-offset-2 hover:no-underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <InboxIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
                No predictions found
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 font-medium">
                Try adjusting your search or advanced filters.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl border border-white/20 dark:border-white/10 overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-sm dark:shadow-none">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/60">
                    {[
                      "Company",
                      "Period",
                      "Model",
                      "Probability",
                      "Risk",
                      "Status",
                      "Date",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                    >
                      <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {p.company_name}
                      </td>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400 font-mono text-xs font-medium">
                        {p.period}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          <Cpu className="w-3.5 h-3.5 text-purple-500" />
                          {p.model_used === "random_forest"
                            ? "R-Forest"
                            : "Log-Reg"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                p.distress_probability >= 0.7
                                  ? "bg-red-500"
                                  : p.distress_probability >= 0.4
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${p.distress_probability * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {(p.distress_probability * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <RiskBadge prob={p.distress_probability} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge label={p.risk_label} />
                      </td>
                      <td className="px-5 py-4 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-bold leading-tight">
                        <span className="block">
                          {formatDate(p.predicted_at)}
                        </span>
                        <span className="block text-zinc-400 dark:text-zinc-600 opacity-60">
                          {formatTime(p.predicted_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() =>
                            setModal({
                              id: p.id,
                              companyName: p.company_name,
                              period: p.period,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 transition-all uppercase tracking-tighter"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 shadow-sm dark:shadow-none"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">
                        {p.company_name}
                      </p>
                      <p className="text-[10px] font-mono font-bold text-zinc-400 mt-0.5 opacity-70">
                        {p.period}
                      </p>
                    </div>
                    <RiskBadge prob={p.distress_probability} />
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 text-[10px] mb-4">
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Model
                      </p>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                        <Cpu className="w-3 h-3 text-purple-500" />
                        {p.model_used === "random_forest"
                          ? "R-Forest"
                          : "Log-Reg"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Probability
                      </p>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 text-xs">
                        {(p.distress_probability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Status
                      </p>
                      <div className="mt-0.5">
                        <StatusBadge label={p.risk_label} />
                      </div>
                    </div>
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Date
                      </p>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                        {formatDate(p.predicted_at)}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-4 border border-zinc-200/30 dark:border-zinc-700/30">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        p.distress_probability >= 0.7
                          ? "bg-red-500"
                          : p.distress_probability >= 0.4
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${p.distress_probability * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() =>
                      setModal({
                        id: p.id,
                        companyName: p.company_name,
                        period: p.period,
                      })
                    }
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors uppercase tracking-widest"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Page{" "}
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {page + 1}
                  </span>{" "}
                  of{" "}
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {totalPages}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile Filters Sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-t-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500 flex flex-col max-h-[85vh]">
            {/* Sheet Handle */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full" />
            </div>
            
            {/* Sheet Header */}
            <div className="px-8 py-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-900">
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Filters</h2>
              <button 
                onClick={() => setMobileFiltersOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Sheet Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Company */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Company</label>
                <div className="relative">
                  <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={tempFilters.companyId}
                    onChange={(e) => setFiltersDraft({ ...tempFilters, companyId: e.target.value })}
                    className="w-full h-14 pl-12 pr-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl text-sm outline-none appearance-none font-bold text-gray-700 dark:text-zinc-200"
                  >
                    <option value="">All Companies</option>
                    {companies.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Model - Horizontal List */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Model Selection</label>
                <div className="flex flex-wrap gap-2">
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFiltersDraft({ ...tempFilters, model: opt.value })}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                        tempFilters.model === opt.value
                          ? "bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/30"
                          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 text-gray-500"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Risk Intensity</label>
                <div className="grid grid-cols-2 gap-3">
                  {RISK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFiltersDraft({ ...tempFilters, risk: opt.value })}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                        tempFilters.risk === opt.value
                          ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800"
                          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 text-gray-500"
                      )}
                    >
                      {opt.label}
                      {tempFilters.risk === opt.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Business Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFiltersDraft({ ...tempFilters, status: opt.value })}
                      className={cn(
                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all border text-left flex items-center justify-between",
                        tempFilters.status === opt.value
                          ? "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800"
                          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 text-gray-500"
                      )}
                    >
                      {opt.label}
                      {tempFilters.status === opt.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Time Period</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter ml-1">From</span>
                    <input
                      type="date"
                      value={tempFilters.startDate}
                      onChange={(e) => setFiltersDraft({ ...tempFilters, startDate: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter ml-1">To</span>
                    <input
                      type="date"
                      value={tempFilters.endDate}
                      onChange={(e) => setFiltersDraft({ ...tempFilters, endDate: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sheet Footer */}
            <div className="p-8 bg-gray-50 dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-900 flex gap-4 sticky bottom-0">
              <button
                onClick={() => {
                  clearFilters();
                  setMobileFiltersOpen(false);
                }}
                className="flex-1 h-14 rounded-[20px] font-bold text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => {
                  setFilters(tempFilters);
                  setPage(0);
                  setMobileFiltersOpen(false);
                }}
                className="flex-[2] h-14 rounded-[20px] bg-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-500/20 active:scale-[0.98] transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {modal !== null && (
        <PredictionDetailModal
          predictionId={modal.id}
          companyName={modal.companyName}
          period={modal.period}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
