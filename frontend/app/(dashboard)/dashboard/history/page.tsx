"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import api from "@/lib/api";
import PredictionDetailModal from "@/components/dashboard/history/PredictionDetailModal";
import { CustomSelect } from "@/components/ui/CustomSelect";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const MODEL_OPTIONS = [
  { value: "", label: "All Models", icon: Cpu },
  { value: "random_forest", label: "Random Forest", icon: Cpu },
  { value: "logistic_regression", label: "Logistic Regression", icon: Cpu },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function modelLabel(model: string) {
  return model === "random_forest" ? "Random Forest" : "Logistic Reg.";
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [predictions, setPredictions] = useState<PredictionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState(0);

  const [modal, setModal] = useState<ModalTarget | null>(null);

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

      const params: Record<string, string | number> = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (companyFilter) params.company_id = companyFilter;
      if (modelFilter) params.model_name = modelFilter;

      const res = await api.get<PaginatedPredictions>("/api/predictions/", {
        params,
      });
      setPredictions(res.data.items);
      setTotal(res.data.total);
    } catch {
      setError(
        "Failed to load prediction history. Make sure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, companyFilter, modelFilter]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  useEffect(() => {
    setPage(0);
  }, [companyFilter, modelFilter]);

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
      <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Prediction History
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Browse and manage your past business health assessments
              </p>
            </div>
          </div>
        </div>

        {/* ── Filters bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-3 rounded-2xl shadow-sm">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by company or period…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
            />
          </div>

          {/* Company filter */}
          <CustomSelect
            options={[
              { value: "", label: "All Companies" },
              ...companies.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
            value={companyFilter}
            onChange={setCompanyFilter}
            icon={Filter}
            className="sm:w-56"
          />

          {/* Model filter */}
          <CustomSelect
            options={MODEL_OPTIONS}
            value={modelFilter}
            onChange={setModelFilter}
            icon={Cpu}
            className="sm:w-48"
          />
        </div>

        {/* Results count */}
        {!loading && !error && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold px-1">
            Showing {filtered.length} of {total} predictions
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading predictions…
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
                {search || companyFilter || modelFilter
                  ? "Try adjusting your filters."
                  : "Run your first prediction from the Predict page."}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {/* ── Desktop table ── */}
            <div className="hidden md:block rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
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
                          {p.model_used === "random_forest" ? "R-Forest" : "Log-Reg"}
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
                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            setModal({
                              id: p.id,
                              companyName: p.company_name,
                              period: p.period,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 opacity-0 group-hover:opacity-100 transition-all uppercase tracking-tighter"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
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
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Model</p>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                        <Cpu className="w-3 h-3 text-purple-500" />
                        {p.model_used === "random_forest" ? "R-Forest" : "Log-Reg"}
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
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Status</p>
                      <div className="mt-0.5">
                        <StatusBadge label={p.risk_label} />
                      </div>
                    </div>
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Date</p>
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

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Page <span className="text-zinc-900 dark:text-zinc-100">{page + 1}</span> of <span className="text-zinc-900 dark:text-zinc-100">{totalPages}</span>
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
