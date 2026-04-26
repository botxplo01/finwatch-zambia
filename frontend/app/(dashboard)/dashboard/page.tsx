"use client";

/**
 * FinWatch Zambia - SME Dashboard
 *
 * Main dashboard displaying company statistics, prediction activity trends,
 * recent assessments, and quick action shortcuts.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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

// Dynamically builds trend data for 7days, 30days, or 3mo
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

// Stat Card

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  trend,
  trendLabel,
  trendGood,
}: StatCardProps) {
  const trendUp = trend === "up";
  const trendDown = trend === "down";
  const trendColor =
    trend === "flat"
      ? "text-gray-400 dark:text-zinc-500"
      : trendUp === trendGood
        ? "text-green-500 dark:text-green-400"
        : "text-red-500 dark:text-red-400";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-200 ${iconBg}`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-50 dark:bg-zinc-800/50 ${trendColor}`}
          >
            {trendUp ? (
              <ChevronUp size={12} strokeWidth={3} />
            ) : trendDown ? (
              <ChevronDown size={12} strokeWidth={3} />
            ) : (
              <Minus size={12} strokeWidth={3} />
            )}
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-0.5 tracking-tight">
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
}

// Main Page

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalPredictions: 0,
    distressCount: 0,
    healthyCount: 0,
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
      let predictions: any[] = [];

      if (companiesRes.status === "fulfilled") {
        const data = companiesRes.value.data;
        companies = Array.isArray(data) ? data : (data.items ?? []);
      }

      if (predictionsRes.status === "fulfilled") {
        const data = predictionsRes.value.data;
        predictions = Array.isArray(data) ? data : (data.items ?? []);
      }

      const distressCount = predictions.filter(
        (p: any) => p.risk_label === "Distressed",
      ).length;

      setStats({
        totalCompanies: companies.length,
        totalPredictions: predictions.length,
        distressCount,
        healthyCount: predictions.length - distressCount,
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
    [trendData],
  );

  return (
    <div className="p-6 pb-20 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Companies"
          value={loading ? "—" : stats.totalCompanies}
          sub="Registered profiles"
          icon={<Building2 size={18} className="text-blue-600" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          trend="flat"
          trendLabel="Active"
          trendGood={true}
        />
        <StatCard
          label="Predictions Run"
          value={loading ? "—" : stats.totalPredictions}
          sub="Session total"
          icon={<TrendingUp size={18} className="text-purple-600" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          trend="up"
          trendLabel="+12%"
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
        {/* Prediction Activity Chart (shadcn style) */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col">
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

            {/* Time Range Selector - flush toggle group */}
            <div className="flex items-center bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden w-fit">
              {(["7d", "30d", "3mo"] as const).map((r, i) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-4 py-2 text-[10px] font-bold transition-all duration-200
                    ${i !== 0 ? "border-l border-gray-100 dark:border-zinc-800" : ""}
                    ${
                      timeRange === r
                        ? "bg-purple-50/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                        : "text-gray-400 hover:bg-gray-100/50 dark:hover:bg-zinc-800/30 hover:text-gray-600 dark:hover:text-zinc-300"
                    }
                  `}
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
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
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
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="fillHealthy"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="fillDistress"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="#f1f5f9"
                    className="dark:opacity-[0.03]"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    interval={
                      timeRange === "7d" ? 0 : timeRange === "30d" ? 4 : 14
                    }
                  />
                  <YAxis hide />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="predictions"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#fillTotal)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="healthy"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#fillHealthy)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="distress"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#fillDistress)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Quick Actions
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 font-medium">
            Jump to common tasks
          </p>

          <div className="space-y-2 flex-1">
            {[
              {
                href: "/dashboard/predict",
                label: "New Prediction",
                sub: "Assess business health",
                color: "bg-purple-600 hover:bg-purple-700",
                icon: <TrendingUp size={15} className="text-white" />,
                primary: true,
              },
              {
                href: "/dashboard/companies",
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
                href: "/dashboard/history",
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
                href: "/dashboard/reports",
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
            ].map(({ href, label, sub, color, icon, primary }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                  ${
                    primary
                      ? `${color} text-white shadow-lg shadow-purple-500/20`
                      : "border border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/50 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 text-gray-700 dark:text-zinc-300"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                    ${primary ? "bg-white/20" : "bg-gray-100 dark:bg-zinc-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30"}`}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-bold ${primary ? "text-white" : "text-gray-800 dark:text-zinc-100"}`}
                  >
                    {label}
                  </p>
                  <p
                    className={`text-[10px] font-medium truncate ${primary ? "text-purple-200" : "text-gray-400 dark:text-zinc-500"}`}
                  >
                    {sub}
                  </p>
                </div>
                <ArrowRight
                  size={13}
                  className={`ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0 ${primary ? "text-purple-200" : "text-purple-400 dark:text-purple-500"}`}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Predictions Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50 dark:border-zinc-800/50">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Recent Assessments
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium tracking-tight">
              Real-time prediction stream
            </p>
          </div>
          <Link
            href="/dashboard/history"
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
          <div className="overflow-x-auto">
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
                  <tr
                    key={pred.id}
                    className="hover:bg-gray-50/40 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800 dark:text-zinc-200 tracking-tight">
                        {pred.company_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 uppercase tracking-tighter">
                        {pred.model_used === "random_forest"
                          ? "R-Forest"
                          : "Log-Reg"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden border border-gray-200/50 dark:border-zinc-700/50">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              pred.distress_probability >= 0.7
                                ? "bg-red-500"
                                : pred.distress_probability >= 0.4
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            }`}
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
                    <td className="px-6 py-4">
                      {riskBadge(pred.distress_probability)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-500 font-mono text-[10px] font-medium">
                      {formatDate(pred.predicted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
