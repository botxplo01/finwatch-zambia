"use client";

/**
 * FinWatch Zambia - SME Dashboard
 */

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  Loader2,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Dynamic import for the unified chart component to improve mobile performance
const DynamicDashboardChart = dynamic(
  () => import("@/components/sme/DashboardChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-50" />
      </div>
    ),
  }
);

// Types

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  trendGood?: boolean;
  trendColorOverride?: string;
  hideTrendIcon?: boolean;
}

interface RecentPrediction {
  id: number;
  company_name: string;
  model_used: string;
  distress_probability: number;
  risk_label: string;
  predicted_at: string;
}

interface DashboardStats {
  totalCompanies: number;
  totalPredictions: number;
  distressCount: number;
  healthyCount: number;
  predictionTrend: "up" | "down" | "flat";
  predictionTrendLabel: string;
}

type TimeRange = "7d" | "30d" | "3mo";

// Helpers

function riskBadge(probability: number) {
  if (probability >= 0.7)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
        High Risk
      </span>
    );
  if (probability >= 0.4)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
        <span className="w-1 h-1 rounded-full bg-amber-500" />
        Medium
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30">
      <span className="w-1 h-1 rounded-full bg-green-500" />
      Healthy
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Dynamically builds trend data for 7days, 30days, or 3months
function buildTrendData(predictions: RecentPrediction[], range: TimeRange) {
  const data: Record<
    string,
    { total: number; distress: number; healthy: number }
  > = {};
  const today = new Date();

  let daysToLookBack = 7;
  if (range === "30d") daysToLookBack = 30;
  if (range === "3mo") daysToLookBack = 90;

  // Initialise range keys
  for (let i = daysToLookBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    data[key] = { total: 0, distress: 0, healthy: 0 };
  }

  predictions.forEach((p) => {
    const key = new Date(p.predicted_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    if (data[key]) {
      data[key].total += 1;
      if (p.risk_label === "Distressed") {
        data[key].distress += 1;
      } else {
        data[key].healthy += 1;
      }
    }
  });

  return Object.entries(data).map(([date, v]) => ({
    date,
    predictions: v.total,
    distress: v.distress,
    healthy: v.healthy,
  }));
}

// Custom Tooltip

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const total =
    payload.find((p: any) => p.dataKey === "predictions")?.value ?? 0;
  const distress =
    payload.find((p: any) => p.dataKey === "distress")?.value ?? 0;
  const healthy = payload.find((p: any) => p.dataKey === "healthy")?.value ?? 0;

  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-xl px-4 py-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-900 dark:text-zinc-100 mb-2 pb-2 border-b border-gray-50 dark:border-zinc-800">
        {label}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Total
          </span>
          <span className="font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
            {total}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Healthy
          </span>
          <span className="font-bold text-green-600 dark:text-green-400 tabular-nums">
            {healthy}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Distress
          </span>
          <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">
            {distress}
          </span>
        </div>
      </div>
    </div>
  );
}

// Stat Card - MEMOIZED for performance
const StatCard = memo(function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  trend,
  trendLabel,
  trendGood,
  trendColorOverride,
  hideTrendIcon,
}: StatCardProps) {
  const trendUp = trend === "up";
  const trendDown = trend === "down";
  const trendColor =
    trendColorOverride ||
    (trend === "flat"
      ? "text-gray-400 dark:text-zinc-500"
      : trendUp === trendGood
      ? "text-green-500 dark:text-green-400"
      : "text-red-500 dark:text-red-400");

  return (
    <div className="bg-white/70 dark:bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/20 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div
          className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-200",
            iconBg
          )}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-gray-50 dark:bg-zinc-800/50 whitespace-nowrap flex-shrink-0 border border-transparent",
              trendColor
            )}
          >
            {trendUp ? (
              <ChevronUp
                className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                strokeWidth={3}
              />
            ) : trendDown ? (
              <ChevronDown
                className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                strokeWidth={3}
              />
            ) : (
              !hideTrendIcon && (
                <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
              )
            )}
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1.5 tracking-tight">
        {value}
      </p>
      <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
        {label}
      </p>
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1.5 font-medium">
          {sub}
        </p>
      )}
    </div>
  );
});

// Recent Prediction Row - MEMOIZED for performance
const RecentPredictionRow = memo(function RecentPredictionRow({
  pred,
}: {
  pred: RecentPrediction;
}) {
  return (
    <tr className="hover:bg-gray-50/40 dark:hover:bg-zinc-800/30 transition-colors">
      <td className="px-6 py-4">
        <span className="font-bold text-gray-800 dark:text-zinc-200 tracking-tight">
          {pred.company_name}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 uppercase tracking-tighter">
          {pred.model_used === "random_forest" ? "R-Forest" : "Log-Reg"}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-20 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden border border-gray-200/50 dark:border-zinc-700/50">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                pred.distress_probability >= 0.7
                  ? "bg-red-500"
                  : pred.distress_probability >= 0.4
                  ? "bg-amber-500"
                  : "bg-green-500"
              )}
              style={{
                width: `${Math.round(pred.distress_probability * 100)}%`,
              }}
            />
          </div>
          <span className="text-gray-900 dark:text-zinc-100 font-bold text-xs tabular-nums">
            {Math.round(pred.distress_probability * 100)}%
          </span>
        </div>
      </td>
      <td className="px-6 py-4">{riskBadge(pred.distress_probability)}</td>
      <td className="px-6 py-4 text-gray-500 dark:text-zinc-500 font-mono text-[10px] font-medium">
        {formatDate(pred.predicted_at)}
      </td>
    </tr>
  );
});

// Main Page

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalPredictions: 0,
    distressCount: 0,
    healthyCount: 0,
    predictionTrend: "flat",
    predictionTrendLabel: "0%",
  });
  const [recentPredictions, setRecentPredictions] = useState<
    RecentPrediction[]
  >([]);
  const [allPredictions, setAllPredictions] = useState<RecentPrediction[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [companiesRes, predictionsRes] = await Promise.allSettled([
        api.get("/api/companies/"),
        api.get("/api/predictions/", { params: { limit: 100 } }),
      ]);

      let companies: any[] = [];
      let predictions: RecentPrediction[] = [];

      if (companiesRes.status === "fulfilled") {
        const data = companiesRes.value.data;
        companies = Array.isArray(data) ? data : data.items ?? [];
      }

      if (predictionsRes.status === "fulfilled") {
        const data = predictionsRes.value.data;
        predictions = Array.isArray(data) ? data : data.items ?? [];
      }

      const distressCount = predictions.filter(
        (p: any) => p.risk_label === "Distressed"
      ).length;

      // Calculate Trend: Last 7 days vs Previous 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000
      );

      const thisWeekCount = predictions.filter(
        (p) => new Date(p.predicted_at) >= sevenDaysAgo
      ).length;
      const lastWeekCount = predictions.filter((p) => {
        const d = new Date(p.predicted_at);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      }).length;

      let trend: "up" | "down" | "flat" = "flat";
      let trendLabel = "0%";

      if (predictions.length === 0) {
        trend = "flat";
        trendLabel = "0%";
      } else if (lastWeekCount === 0) {
        if (thisWeekCount > 0) {
          trend = "up";
          trendLabel = `+${thisWeekCount * 100}%`;
        } else {
          trend = "flat";
          trendLabel = "0%";
        }
      } else {
        const percentChange = Math.round(
          ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100
        );
        if (percentChange > 0) {
          trend = "up";
          trendLabel = `+${percentChange}%`;
        } else if (percentChange < 0) {
          trend = "down";
          trendLabel = `${percentChange}%`;
        } else {
          trend = "flat";
          trendLabel = "0%";
        }
      }

      setStats({
        totalCompanies: companies.length,
        totalPredictions: predictions.length,
        distressCount,
        healthyCount: predictions.length - distressCount,
        predictionTrend: trend,
        predictionTrendLabel: trendLabel,
      });

      setRecentPredictions(predictions.slice(0, 5));
      setAllPredictions(predictions);
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    window.addEventListener("focus", fetchDashboardData);
    return () => window.removeEventListener("focus", fetchDashboardData);
  }, [fetchDashboardData]);

  // Memoized trend data based on selected range
  const trendData = useMemo(() => {
    return buildTrendData(allPredictions, timeRange);
  }, [allPredictions, timeRange]);

  const distressRate =
    stats.totalPredictions > 0
      ? Math.round((stats.distressCount / stats.totalPredictions) * 100)
      : 0;

  // Window-specific totals for the chart header
  const rangeTotals = useMemo(
    () => ({
      total: trendData.reduce((s, d) => s + d.predictions, 0),
      distress: trendData.reduce((s, d) => s + d.distress, 0),
      healthy: trendData.reduce((s, d) => s + d.healthy, 0),
    }),
    [trendData]
  );

  return (
    <div
      id="dashboard-overview"
      className="p-6 pb-20 space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-500"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Companies"
          value={loading ? "—" : stats.totalCompanies}
          sub="Registered profiles"
          icon={<Building2 size={18} className="text-blue-600" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          trend="flat"
          trendLabel={stats.totalCompanies > 0 ? "Active" : "—"}
          hideTrendIcon={stats.totalCompanies > 0}
          trendColorOverride={
            stats.totalCompanies > 0
              ? "text-blue-600 dark:text-blue-400"
              : undefined
          }
        />
        <StatCard
          label="Predictions Run"
          value={loading ? "—" : stats.totalPredictions}
          sub="Session total"
          icon={<TrendingUp size={18} className="text-purple-600" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          trend={stats.predictionTrend}
          trendLabel={stats.predictionTrendLabel}
          trendGood={true}
        />
        <StatCard
          label="Distress Flags"
          value={loading ? "—" : stats.distressCount}
          sub={`${distressRate}% system-wide`}
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
          trend={stats.distressCount > 0 ? "up" : "flat"}
          trendLabel="High Alert"
          trendGood={false}
        />
        <StatCard
          label="Healthy SME"
          value={loading ? "—" : stats.healthyCount}
          sub={`${100 - distressRate}% system-wide`}
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
          trend={stats.healthyCount > 0 ? "up" : "flat"}
          trendLabel="Stable"
          trendGood={true}
        />
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Prediction Activity Chart */}
        <div className="lg:col-span-3 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-sm flex flex-col">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 pt-6 pb-4 gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                Prediction Activity
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
                Daily assessment volume & classifications
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden w-fit mx-auto sm:mx-0">
              {(["7d", "30d", "3mo"] as const).map((r, i) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold transition-all duration-200",
                    i !== 0 && "border-l border-gray-100 dark:border-zinc-800",
                    timeRange === r
                      ? "bg-purple-50/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                      : "text-gray-400 hover:bg-gray-100/50 dark:hover:bg-zinc-800/30 hover:text-gray-600 dark:hover:text-zinc-300"
                  )}
                >
                  {r === "7d"
                    ? "Last 7 days"
                    : r === "30d"
                    ? "Last 30 days"
                    : "Last 3 months"}
                </button>
              ))}
            </div>
          </div>

          {/* Metric Row */}
          <div className="px-6 pb-6 flex items-center gap-8 border-b border-gray-50 dark:border-zinc-800/50">
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-zinc-100 tabular-nums">
                {loading ? "—" : rangeTotals.total}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  Total
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                {loading ? "—" : rangeTotals.healthy}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  Healthy
                </span>
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500 dark:text-red-400 tabular-nums">
                {loading ? "—" : rangeTotals.distress}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  Distress
                </span>
              </div>
            </div>
          </div>

          {/* Chart Body */}
          <div className="flex-1 p-0 mt-4">
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-purple-500" />
              </div>
            ) : allPredictions.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-center gap-2 px-6">
                <TrendingUp
                  size={32}
                  className="text-gray-200 dark:text-zinc-800"
                />
                <p className="text-sm text-gray-400 dark:text-zinc-600 font-medium">
                  No activity data for this period
                </p>
              </div>
            ) : (
              <DynamicDashboardChart
                data={trendData}
                timeRange={timeRange}
                TooltipContent={ChartTooltip}
              />
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Quick Actions
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 font-medium">
            Jump to common tasks
          </p>

          <div className="space-y-2 flex-1">
            {[
              {
                href: "/sme/predict",
                label: "New Prediction",
                sub: "Assess business health",
                color:
                  "bg-purple-100/90 dark:bg-purple-900/60 backdrop-blur-md border border-purple-200/80 dark:border-purple-800/50",
                icon: (
                  <TrendingUp
                    size={15}
                    className="text-purple-600 dark:text-purple-400"
                  />
                ),
                primary: true,
                id: "action-predict",
              },
              {
                href: "/sme/companies",
                label: "Add Company",
                sub: "Register a profile",
                color: "",
                icon: (
                  <Building2
                    size={15}
                    className="text-gray-600 dark:text-zinc-400"
                  />
                ),
                primary: false,
              },
              {
                href: "/sme/history",
                label: "View History",
                sub: "Browse assessments",
                color: "",
                icon: (
                  <Clock
                    size={15}
                    className="text-gray-600 dark:text-zinc-400"
                  />
                ),
                primary: false,
              },
              {
                href: "/sme/reports",
                label: "Export Reports",
                sub: "PDF & CSV delivery",
                color: "",
                icon: (
                  <ArrowRight
                    size={15}
                    className="text-gray-600 dark:text-zinc-400"
                  />
                ),
                primary: false,
              },
            ].map(({ href, label, sub, color, icon, primary, id }) => (
              <Link
                key={href}
                href={href}
                id={id}
                className={cn(
                  "flex items-center justify-start gap-4 p-4 rounded-2xl transition-all duration-200 group",
                  primary
                    ? `${color} hover:bg-purple-100 dark:hover:bg-purple-900/80 shadow-sm`
                    : "border border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/50 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 text-gray-700 dark:text-zinc-300"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                    primary
                      ? "bg-purple-100 dark:bg-purple-900/40"
                      : "bg-gray-100 dark:bg-zinc-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30"
                  )}
                >
                  {icon}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      primary
                        ? "text-purple-900 dark:text-purple-100"
                        : "text-gray-800 dark:text-zinc-100"
                    )}
                  >
                    {label}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] font-medium truncate",
                      primary
                        ? "text-purple-600/70 dark:text-purple-400/70"
                        : "text-gray-400 dark:text-zinc-500"
                    )}
                  >
                    {sub}
                  </p>
                </div>
                <ArrowRight
                  size={13}
                  className={cn(
                    "ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0",
                    primary
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-purple-400 dark:text-purple-500"
                  )}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Predictions Table */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100/50 dark:border-white/10">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Recent Assessments
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium tracking-tight">
              Real-time prediction stream
            </p>
          </div>
          <Link
            href="/sme/history"
            className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors uppercase tracking-widest border border-gray-100 dark:border-zinc-700"
          >
            Full History
          </Link>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-purple-500" />
          </div>
        ) : recentPredictions.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 flex items-center justify-center border border-gray-100 dark:border-zinc-800">
              <TrendingUp
                size={20}
                className="text-gray-300 dark:text-zinc-700"
              />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-600 font-medium">
              No assessments recorded
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-zinc-800/50 bg-gray-50/30 dark:bg-zinc-900/30">
                    {[
                      "Company",
                      "Model",
                      "Distress Probability",
                      "Status",
                      "Date",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3.5 text-left text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                  {recentPredictions.map((pred) => (
                    <RecentPredictionRow key={pred.id} pred={pred} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3 p-4">
              {recentPredictions.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 shadow-sm dark:shadow-none"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tracking-tight">
                      {p.company_name}
                    </p>
                    {riskBadge(p.distress_probability)}
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
                        {Math.round(p.distress_probability * 100)}%
                      </p>
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
                  <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-850 overflow-hidden border border-zinc-200/30 dark:border-zinc-750/30">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        p.distress_probability >= 0.7
                          ? "bg-red-500"
                          : p.distress_probability >= 0.4
                          ? "bg-amber-500"
                          : "bg-green-500"
                      )}
                      style={{
                        width: `${Math.round(p.distress_probability * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
