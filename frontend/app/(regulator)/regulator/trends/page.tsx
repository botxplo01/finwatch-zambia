"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "@/lib/api";
import { getRegAuthHeader } from "@/lib/regulator-auth";

interface TrendItem {
  period: string;
  total_assessments: number;
  distress_count: number;
  healthy_count: number;
  distress_rate: number;
  avg_distress_prob: number;
}

interface RiskDistItem {
  tier: string;
  count: number;
  percentage: number;
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [distrib, setDistrib] = useState<RiskDistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const headers = getRegAuthHeader();
    Promise.all([
      api.get("/api/regulator/trends", { headers }),
      api.get("/api/regulator/risk-distribution", { headers }),
    ])
      .then(([trendRes, distRes]) => {
        setTrends(trendRes.data);
        setDistrib(distRes.data);
      })
      .catch(() => setError("Failed to load trend data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );

  // Calculate MoM change for the last two months
  const last = trends[trends.length - 1];
  const prev = trends[trends.length - 2];
  const momChange = last && prev ? last.distress_rate - prev.distress_rate : 0;
  const momPct = (momChange * 100).toFixed(1);

  const trendData = trends.map((t) => ({
    period: t.period,
    "Distress Rate": parseFloat((t.distress_rate * 100).toFixed(1)),
    Assessments: t.total_assessments,
    "Avg Prob": parseFloat((t.avg_distress_prob * 100).toFixed(1)),
  }));

  const stackData = trends.map((t) => ({
    period: t.period,
    Healthy: t.healthy_count,
    Distressed: t.distress_count,
  }));

  const DIST_COLORS: Record<string, string> = {
    High: "#ef4444",
    Medium: "#f59e0b",
    Low: "#22c55e",
  };

  return (
    <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
          Temporal Trends
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
          Month-by-month distress rate, assessment volume, and risk distribution
          over the trailing 12 months.
        </p>
      </div>

      {/* MoM summary cards */}
      {last && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Latest Month",
              value: last.period,
              sub: `${last.total_assessments} assessments`,
              icon: <TrendingUp size={16} className="text-purple-600" />,
              bg: "bg-purple-50 dark:bg-purple-900/20",
            },
            {
              label: "Current Distress Rate",
              value: `${(last.distress_rate * 100).toFixed(1)}%`,
              sub: "High risk tier ≥70%",
              icon:
                momChange > 0 ? (
                  <TrendingUp size={16} className="text-red-500" />
                ) : momChange < 0 ? (
                  <TrendingDown size={16} className="text-green-500" />
                ) : (
                  <Minus size={16} className="text-gray-400" />
                ),
              bg:
                momChange > 0
                  ? "bg-red-50 dark:bg-red-900/20"
                  : momChange < 0
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "bg-gray-50 dark:bg-zinc-800",
            },
            {
              label: "Month-on-Month Change",
              value: `${momChange >= 0 ? "+" : ""}${momPct}%`,
              sub: prev ? `vs ${prev.period}` : "No prior month",
              icon:
                momChange > 0 ? (
                  <TrendingUp size={16} className="text-red-500" />
                ) : (
                  <TrendingDown size={16} className="text-green-500" />
                ),
              bg:
                momChange > 0
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-green-50 dark:bg-green-900/20",
            },
            {
              label: "Total Period Assessments",
              value: trends.reduce((a, t) => a + t.total_assessments, 0),
              sub: `Over ${trends.length} months`,
              icon: <TrendingUp size={16} className="text-blue-600" />,
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
          ].map(({ label, value, sub, icon, bg }) => (
            <div
              key={label}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5"
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${bg}`}
              >
                {icon}
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-0.5">
                {value}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {label}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                {sub}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Distress rate area chart */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Distress Rate Over Time
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Average distress probability across all assessments per month (%)
        </p>

        {trendData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
            No trend data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={trendData}
              margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                formatter={(v: number, name: string) => [`${v}%`, name]}
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="Distress Rate"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ef4444" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Avg Prob"
                stroke="#6d28d9"
                strokeWidth={2}
                dot={{ r: 3, fill: "#6d28d9" }}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stacked assessment volume chart */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Assessment Volume by Outcome
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Monthly count of healthy vs distressed predictions
        </p>

        {stackData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={stackData}
              margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Healthy" fill="#22c55e" stackId="a" />
              <Bar
                dataKey="Distressed"
                fill="#ef4444"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Risk distribution strip */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-4">
          Overall Risk Distribution
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {distrib.map((d) => (
            <div key={d.tier} className="text-center">
              <div
                className="h-2 rounded-full mb-2"
                style={{ background: DIST_COLORS[d.tier] ?? "#9ca3af" }}
              />
              <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {d.count}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                {d.tier} Risk
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                {d.percentage}% of all
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
