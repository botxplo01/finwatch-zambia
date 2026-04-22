"use client";

import { useEffect, useState, useCallback } from "react";
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

// ── Types ────────────────────────────────────────────────────────────────────

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
  predicted_at: string; // ← was created_at (wrong field name)
}

interface DashboardStats {
  totalCompanies: number;
  totalPredictions: number;
  distressCount: number;
  healthyCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// Build last-7-days trend data from predictions list
// FIX: uses predicted_at (correct API field), not created_at
function buildTrendData(predictions: RecentPrediction[]) {
  const days: Record<string, { total: number; distress: number }> = {};
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    days[key] = { total: 0, distress: 0 };
  }

  predictions.forEach((p) => {
    // ✅ FIX: was p.created_at — correct field is p.predicted_at
    const key = new Date(p.predicted_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    if (days[key]) {
      days[key].total += 1;
      if (p.risk_label === "Distressed") days[key].distress += 1;
    }
  });

  return Object.entries(days).map(([date, v]) => ({
    date,
    predictions: v.total,
    distress: v.distress,
  }));
}

// ── Custom Tooltip (shadcn-style card) ───────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total =
    payload.find((p: any) => p.dataKey === "predictions")?.value ?? 0;
  const distress =
    payload.find((p: any) => p.dataKey === "distress")?.value ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-md px-3.5 py-2.5 text-xs min-w-[130px]">
      <p className="font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
        {label}
      </p>
      <div className="flex items-center justify-between gap-4 mb-0.5">
        <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Predictions
        </span>
        <span className="font-semibold text-gray-800 dark:text-zinc-100 tabular-nums">
          {total}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          Distress
        </span>
        <span className="font-semibold text-gray-800 dark:text-zinc-100 tabular-nums">
          {distress}
        </span>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

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
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}
          >
            {trendUp ? (
              <ChevronUp size={13} />
            ) : trendDown ? (
              <ChevronDown size={13} />
            ) : (
              <Minus size={13} />
            )}
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">
        {value}
      </p>
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
      {sub && (
        <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
  const [trendData, setTrendData] = useState<ReturnType<typeof buildTrendData>>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [companiesRes, predictionsRes] = await Promise.allSettled([
        api.get("/api/companies/"),
        api.get("/api/predictions/", { params: { limit: 50 } }),
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
      setTrendData(buildTrendData(predictions));
    } catch {
      // Graceful degradation — show zeros
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    window.addEventListener("focus", fetchDashboardData);
    return () => window.removeEventListener("focus", fetchDashboardData);
  }, [fetchDashboardData]);

  const distressRate =
    stats.totalPredictions > 0
      ? Math.round((stats.distressCount / stats.totalPredictions) * 100)
      : 0;

  // Totals for the chart header (shadcn style)
  const totalPredictionsInWindow = trendData.reduce(
    (s, d) => s + d.predictions,
    0,
  );
  const totalDistressInWindow = trendData.reduce((s, d) => s + d.distress, 0);

  return (
    <div className="p-6 pb-24 space-y-6 max-w-7xl mx-auto">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Companies"
          value={loading ? "—" : stats.totalCompanies}
          sub="Registered profiles"
          icon={<Building2 size={18} className="text-blue-600" />}
          iconBg="bg-blue-50"
          trend="flat"
          trendLabel="All time"
          trendGood={true}
        />
        <StatCard
          label="Total Predictions"
          value={loading ? "—" : stats.totalPredictions}
          sub="Both LR and RF"
          icon={<TrendingUp size={18} className="text-purple-600" />}
          iconBg="bg-purple-50"
          trend="up"
          trendLabel="This session"
          trendGood={true}
        />
        <StatCard
          label="Distress Flags"
          value={loading ? "—" : stats.distressCount}
          sub={`${distressRate}% of all predictions`}
          icon={<AlertTriangle size={18} className="text-red-500" />}
          iconBg="bg-red-50"
          trend={stats.distressCount > 0 ? "up" : "flat"}
          trendLabel={`${distressRate}%`}
          trendGood={false}
        />
        <StatCard
          label="Healthy Assessments"
          value={loading ? "—" : stats.healthyCount}
          sub={`${100 - distressRate}% of all predictions`}
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          iconBg="bg-green-50"
          trend={stats.healthyCount > 0 ? "up" : "flat"}
          trendLabel={`${100 - distressRate}%`}
          trendGood={true}
        />
      </div>

      {/* ── Chart + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Prediction Activity Chart (shadcn Total Visitors style) ── */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Card header — totals + legend like shadcn */}
          <div className="px-6 pt-5 pb-0">
            <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium">
              Prediction Activity
            </p>

            {/* Two-column metric row */}
            <div className="flex items-end gap-6 mt-2 mb-4">
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                  {loading ? "—" : totalPredictionsInWindow}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    Predictions
                  </span>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tabular-nums leading-none">
                  {loading ? "—" : totalDistressInWindow}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    Distress flags
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 ml-auto self-end pb-0.5">
                Last 7 days
              </p>
            </div>
          </div>

          {/* Chart body */}
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            </div>
          ) : trendData.every((d) => d.predictions === 0) ? (
            <div className="h-48 flex flex-col items-center justify-center text-center gap-2 px-6">
              <TrendingUp
                size={28}
                className="text-gray-200 dark:text-zinc-700"
              />
              <p className="text-sm text-gray-400 dark:text-zinc-500">
                No predictions yet. Run your first assessment to see trends.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={trendData}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                    <stop
                      offset="100%"
                      stopColor="#7c3aed"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                  <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop
                      offset="100%"
                      stopColor="#ef4444"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                  className="dark:opacity-[0.06]"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{
                    stroke: "#e5e7eb",
                    strokeWidth: 1,
                    strokeDasharray: "4 2",
                  }}
                />
                {/* Predictions area (bottom layer) */}
                <Area
                  type="natural"
                  dataKey="predictions"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#gradPurple)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
                />
                {/* Distress area (top layer, stacked visually) */}
                <Area
                  type="natural"
                  dataKey="distress"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradRed)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Quick Actions
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Jump to common tasks
          </p>

          <div className="space-y-2 flex-1">
            {[
              {
                href: "/dashboard/predict",
                label: "Run New Prediction",
                sub: "Assess a company's distress risk",
                color: "bg-purple-600 hover:bg-purple-700",
                icon: <TrendingUp size={15} className="text-white" />,
                primary: true,
              },
              {
                href: "/dashboard/companies",
                label: "Add Company",
                sub: "Register a new SME profile",
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
                sub: "Browse all past predictions",
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
                label: "Generate Report",
                sub: "Export a PDF assessment",
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
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group
                  ${
                    primary
                      ? `${color} text-white`
                      : "border border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 text-gray-700 dark:text-zinc-300"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${primary ? "bg-white/20" : "bg-gray-100 dark:bg-zinc-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30"}`}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${primary ? "text-white" : "text-gray-800 dark:text-zinc-100"}`}
                  >
                    {label}
                  </p>
                  <p
                    className={`text-[11px] truncate ${primary ? "text-purple-200" : "text-gray-400 dark:text-zinc-500"}`}
                  >
                    {sub}
                  </p>
                </div>
                <ArrowRight
                  size={13}
                  className={`ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${primary ? "text-purple-200" : "text-purple-400 dark:text-purple-500"}`}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Predictions Table ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 dark:border-zinc-800/50">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recent Predictions
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Latest 5 assessments
            </p>
          </div>
          <Link
            href="/dashboard/history"
            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
          </div>
        ) : recentPredictions.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
              <TrendingUp
                size={20}
                className="text-gray-300 dark:text-zinc-600"
              />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              No predictions yet
            </p>
            <Link
              href="/dashboard/predict"
              className="text-xs text-purple-600 dark:text-purple-400 font-medium hover:underline"
            >
              Run your first assessment →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-zinc-800/50">
                  {[
                    "Company",
                    "Model",
                    "Probability",
                    "Risk Level",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide"
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
                    className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-default"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-gray-800 dark:text-zinc-200">
                        {pred.company_name}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                        {pred.model_used === "random_forest" ? "RF" : "LR"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pred.distress_probability >= 0.7
                                ? "bg-red-500"
                                : pred.distress_probability >= 0.4
                                  ? "bg-amber-400"
                                  : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.round(pred.distress_probability * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-gray-700 dark:text-zinc-300 font-medium text-xs tabular-nums">
                          {Math.round(pred.distress_probability * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {riskBadge(pred.distress_probability)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-400 dark:text-zinc-500 text-xs">
                      {/* ✅ FIX: was pred.created_at — correct field is pred.predicted_at */}
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
