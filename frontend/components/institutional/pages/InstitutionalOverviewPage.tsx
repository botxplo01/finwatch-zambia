"use client";

/**
 * FinWatch Zambia - Institutional Overview Page Component
 */

import { useEffect, useState, memo } from "react";
import {
  Building2,
  AlertTriangle,
  Loader2,
  BarChart3,
  Activity,
} from "lucide-react";
import api from "@/lib/api";
import {
  getInstitutionalAuthHeader,
  getInstitutionalUser,
  InstitutionalUserResponse,
} from "@/lib/institutional-auth";
import { useInstitutionalFilter } from "@/context/InstitutionalFilterContext";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { InstitutionalFilterBar } from "@/components/institutional/InstitutionalFilterBar";

// Dynamic import for heavy charting component
const DynamicInstitutionalCharts = dynamic(
  () => import("@/components/institutional/InstitutionalCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[300px] bg-white/30 dark:bg-white/5 animate-pulse rounded-2xl border border-white/10" />
        <div className="h-[300px] bg-white/30 dark:bg-white/5 animate-pulse rounded-2xl border border-white/10" />
      </div>
    ),
  }
);

// Types

interface SystemOverview {
  total_assessments: number;
  total_companies: number;
  total_sme_owners: number;
  overall_distress_rate: number;
  avg_distress_prob: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  sectors_covered: number;
  small_scale_count: number;
  medium_scale_count: number;
  last_updated: string;
}

interface SectorItem {
  industry: string;
  total_assessments: number;
  distress_rate: number;
  avg_distress_prob: number;
}

interface ModelPerfItem {
  model_name: string;
  total_predictions: number;
  distress_count: number;
  healthy_count: number;
  distress_rate: number;
}

interface ScaleItem {
  scale: string;
  total_assessments: number;
  distress_count: number;
  healthy_count: number;
  distress_rate: number;
}

// Helpers

const RISK_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const SECTOR_COLORS = [
  "#6d28d9",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
];

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// KPI Card - MEMOIZED for performance
const KPICard = memo(function KPICard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
          accent
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1.5 tabular-nums">
        {value}
      </p>
      <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
        {label}
      </p>
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
});

// Sector Row - MEMOIZED for performance
const SectorRow = memo(function SectorRow({
  s,
  i,
}: {
  s: SectorItem;
  i: number;
}) {
  const isHigh = s.distress_rate >= 0.7;
  const isMed = s.distress_rate >= 0.4;
  return (
    <tr className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{
              background: SECTOR_COLORS[i % SECTOR_COLORS.length],
            }}
          />
          <span className="font-medium text-gray-800 dark:text-zinc-100">
            {s.industry}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-400 tabular-nums">
        {s.total_assessments}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                isHigh ? "bg-red-500" : isMed ? "bg-amber-400" : "bg-green-500"
              )}
              style={{ width: `${s.distress_rate * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200 tabular-nums">
            {pct(s.distress_rate)}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-400 tabular-nums font-mono text-xs">
        {pct(s.avg_distress_prob)}
      </td>
      <td className="px-5 py-3.5">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
            isHigh
              ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              : isMed
              ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
              : "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
          )}
        >
          {isHigh ? "High" : isMed ? "Medium" : "Low"}
        </span>
      </td>
    </tr>
  );
});

// Component

export default function InstitutionalOverviewPage() {
  const { selectedScales, selectedSectors } = useInstitutionalFilter();
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [modelPerf, setModelPerf] = useState<ModelPerfItem[]>([]);
  const [scales, setScales] = useState<ScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("regulator");

  useEffect(() => {
    async function fetchAll() {
      const headers = getInstitutionalAuthHeader();
      const user = getInstitutionalUser<InstitutionalUserResponse>();
      if (user) setUserRole(user.role);

      const params = {
        scale: selectedScales.join(","),
        sector: selectedSectors.join(","),
      };

      try {
        const [ovRes, secRes, modRes, scaleRes] = await Promise.all([
          api.get("/api/institutional/overview", { headers, params }),
          api.get("/api/institutional/sectors", { headers, params }),
          api.get("/api/institutional/model-performance", { headers, params }),
          api.get("/api/institutional/scales", { headers, params }),
        ]);
        setOverview(ovRes.data);
        setSectors(secRes.data.slice(0, 6));
        setModelPerf(modRes.data);
        setScales(scaleRes.data);
      } catch {
        setError("Failed to load institutional data. Check your session.");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [selectedScales, selectedSectors]);

  const isAnalyst = userRole === "policy_analyst";
  const loaderColor = isAnalyst ? "text-blue-600" : "text-emerald-500";

  if (loading)
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 size={28} className={cn("animate-spin", loaderColor)} />
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
      </div>
    );

  const distrib = overview
    ? [
        {
          name: "High Risk",
          value: overview.high_risk_count,
          color: RISK_COLORS.High,
        },
        {
          name: "Medium Risk",
          value: overview.medium_risk_count,
          color: RISK_COLORS.Medium,
        },
        {
          name: "Low Risk",
          value: overview.low_risk_count,
          color: RISK_COLORS.Low,
        },
      ]
    : [];

  const modelChartData = modelPerf.map((m) => ({
    name: m.model_name === "random_forest" ? "Random Forest" : "Logistic Reg.",
    Healthy: m.healthy_count,
    Distress: m.distress_count,
  }));

  const scaleChartData = scales.map((s) => ({
    name: s.scale,
    Healthy: s.healthy_count,
    Distress: s.distress_count,
  }));

  return (
    <div
      id="dashboard-overview"
      className="p-6 pb-20 max-w-screen-2xl mx-auto space-y-6 animate-in fade-in duration-500"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
            {isAnalyst ? "Policy Synthesis Overview" : "System Overview"}
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            {isAnalyst
              ? "Strategic synthesis of sector-wide financial trends and risk patterns for policy review."
              : "Aggregate, anonymised financial distress intelligence across all Zambian SMEs assessed."}
          </p>
        </div>
        {overview && (
          <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-right flex-shrink-0">
            Last updated
            <br />
            <span className="font-mono">
              {formatDate(overview.last_updated)}
            </span>
          </p>
        )}
      </div>

      <InstitutionalFilterBar />

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Total Assessments"
            value={overview.total_assessments}
            sub="Across all companies"
            icon={
              <BarChart3
                size={18}
                className={isAnalyst ? "text-blue-600" : "text-purple-600"}
              />
            }
            accent={
              isAnalyst
                ? "bg-blue-50 dark:bg-blue-900/20"
                : "bg-purple-50 dark:bg-purple-900/20"
            }
          />
          <KPICard
            label="Companies Assessed"
            value={overview.total_companies}
            sub={`${overview.small_scale_count} Small · ${overview.medium_scale_count} Medium`}
            icon={
              <Building2
                size={18}
                className={isAnalyst ? "text-sky-600" : "text-blue-600"}
              />
            }
            accent={
              isAnalyst
                ? "bg-sky-50 dark:bg-sky-900/20"
                : "bg-blue-50 dark:bg-blue-900/20"
            }
          />
          <KPICard
            label="Overall Distress Rate"
            value={pct(overview.overall_distress_rate)}
            sub="High risk tier (≥70%)"
            icon={<AlertTriangle size={18} className="text-red-500" />}
            accent="bg-red-50 dark:bg-red-900/20"
          />
          <KPICard
            label="Avg Distress Probability"
            value={pct(overview.avg_distress_prob)}
            sub="Across all predictions"
            icon={
              <Activity
                size={18}
                className={isAnalyst ? "text-indigo-600" : "text-emerald-600"}
              />
            }
            accent={
              isAnalyst
                ? "bg-indigo-50 dark:bg-indigo-900/20"
                : "bg-emerald-50 dark:bg-emerald-900/20"
            }
          />
        </div>
      )}

      {/* Two column charts component */}
      <DynamicInstitutionalCharts
        distrib={distrib}
        modelChartData={modelChartData}
        scaleChartData={scaleChartData}
        isAnalyst={isAnalyst}
      />

      {/* Sector table */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="px-6 py-4 border-b border-gray-100/50 dark:border-white/10">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
            Top Sectors by Distress Rate
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            Sectors with fewer than 3 assessments are suppressed for privacy
          </p>
        </div>

        {sectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 bg-gray-50/50 dark:bg-zinc-800/30">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-sm",
                isAnalyst
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                  : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
              )}
            >
              <Building2 size={24} />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              No Sector Data Available
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Sectoral distress patterns will emerge as more SMEs are assessed
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                    {[
                      "Sector",
                      "Assessments",
                      "Distress Rate",
                      "Avg Probability",
                      "Risk Level",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {sectors.map((s, i) => (
                    <SectorRow key={`${s.industry}-${i}`} s={s} i={i} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3 p-4">
              {sectors.map((s, i) => {
                const isHigh = s.distress_rate >= 0.7;
                const isMed = s.distress_rate >= 0.4;
                return (
                  <div
                    key={`${s.industry}-${i}`}
                    className="rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 shadow-sm dark:shadow-none text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{
                            background: SECTOR_COLORS[i % SECTOR_COLORS.length],
                          }}
                        />
                        <span className="font-bold text-gray-800 dark:text-zinc-100 text-sm tracking-tight">
                          {s.industry}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          isHigh
                            ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                            : isMed
                            ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                            : "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                        )}
                      >
                        {isHigh ? "High" : isMed ? "Medium" : "Low"} Risk
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-y-3 text-[10px] mb-4">
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                          Assessments
                        </p>
                        <p className="font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                          {s.total_assessments}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                          Distress Rate
                        </p>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {pct(s.distress_rate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                          Avg Prob
                        </p>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {pct(s.avg_distress_prob)}
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-750 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isHigh ? "bg-red-500" : isMed ? "bg-amber-400" : "bg-green-500"
                        )}
                        style={{ width: `${s.distress_rate * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
