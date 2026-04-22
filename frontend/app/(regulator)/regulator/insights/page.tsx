"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import api from "@/lib/api";
import { getRegAuthHeader } from "@/lib/regulator-auth";

interface SectorItem {
  industry: string;
  total_assessments: number;
  distress_count: number;
  healthy_count: number;
  distress_rate: number;
  avg_distress_prob: number;
  avg_current_ratio: number;
  avg_debt_to_assets: number;
}

interface TrendItem {
  period: string;
  total_assessments: number;
  distress_rate: number;
  avg_distress_prob: number;
}

interface RatioItem {
  ratio_name: string;
  avg_value: number;
  distressed_avg: number;
  healthy_avg: number;
}

const RATIO_LABELS: Record<string, string> = {
  current_ratio: "Current Ratio",
  quick_ratio: "Quick Ratio",
  cash_ratio: "Cash Ratio",
  debt_to_equity: "Debt/Equity",
  debt_to_assets: "Debt/Assets",
  interest_coverage: "Interest Cov.",
  net_profit_margin: "Net Profit Margin",
  return_on_assets: "ROA",
  return_on_equity: "ROE",
  asset_turnover: "Asset Turnover",
};

export default function InsightsPage() {
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [ratios, setRatios] = useState<RatioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetch() {
      const headers = getRegAuthHeader();
      try {
        const [secRes, trendRes, ratioRes] = await Promise.all([
          api.get("/api/regulator/sectors", { headers }),
          api.get("/api/regulator/trends", { headers }),
          api.get("/api/regulator/ratios", { headers }),
        ]);
        setSectors(secRes.data);
        setTrends(trendRes.data);
        setRatios(ratioRes.data);
      } catch {
        setError("Failed to load insights data.");
      } finally {
        setLoading(false);
      }
    }
    fetch();
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
        <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
      </div>
    );

  const sectorChartData = sectors.map((s) => ({
    name: s.industry.length > 14 ? s.industry.slice(0, 14) + "…" : s.industry,
    fullName: s.industry,
    "Distress Rate": parseFloat((s.distress_rate * 100).toFixed(1)),
    Assessments: s.total_assessments,
  }));

  const ratioChartData = ratios.map((r) => ({
    name: RATIO_LABELS[r.ratio_name] ?? r.ratio_name,
    "Distressed Avg": parseFloat(r.distressed_avg.toFixed(3)),
    "Healthy Avg": parseFloat(r.healthy_avg.toFixed(3)),
  }));

  const trendChartData = trends.map((t) => ({
    period: t.period,
    "Distress Rate": parseFloat((t.distress_rate * 100).toFixed(1)),
    Assessments: t.total_assessments,
  }));

  return (
    <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
          Sector Insights
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
          Deep-dive into industry-level distress patterns, ratio benchmarks, and
          temporal trends.
        </p>
      </div>

      {/* ── Distress by sector bar chart ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Distress Rate by Sector
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Average distress probability per industry (%)
        </p>

        {sectorChartData.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-sm text-gray-300 dark:text-zinc-600">
            No sector data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={sectorChartData}
              margin={{ top: 4, right: 8, left: -20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                angle={-25}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Distress Rate"]}
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }}
              />
              <ReferenceLine
                y={70}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "High threshold",
                  fill: "#ef4444",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={40}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "Medium threshold",
                  fill: "#f59e0b",
                  fontSize: 10,
                }}
              />
              <Bar
                dataKey="Distress Rate"
                fill="#6d28d9"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Trend chart ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Monthly Distress Trend
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Trailing 12-month average distress probability (%)
        </p>

        {trendChartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
            No trend data yet — assessments appear here over time
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={trendChartData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradDR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6d28d9" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                formatter={(v: number) => [`${v}%`, "Distress Rate"]}
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="Distress Rate"
                stroke="#6d28d9"
                strokeWidth={2}
                fill="url(#gradDR)"
                dot={{ r: 3, fill: "#6d28d9" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Ratio benchmarks chart ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Financial Ratio Benchmarks
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Average ratio values comparing distressed vs healthy companies —
          useful for setting policy thresholds
        </p>

        {ratioChartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
            No ratio data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={ratioChartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 80, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f3f4f6"
              />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="Distressed Avg"
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
              />
              <Bar
                dataKey="Healthy Avg"
                fill="#22c55e"
                radius={[0, 4, 4, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-3">
          Policy implication: Ratios with the largest gap between distressed and
          healthy averages are the strongest predictors of financial distress in
          the Zambian SME context.
        </p>
      </div>

      {/* ── Detailed sector table ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
            Detailed Sector Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                {[
                  "Sector",
                  "Assessments",
                  "Distress",
                  "Healthy",
                  "Distress Rate",
                  "Avg Current Ratio",
                  "Avg Debt/Assets",
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
              {sectors.map((s) => (
                <tr
                  key={s.industry}
                  className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-zinc-100">
                    {s.industry}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-400 tabular-nums">
                    {s.total_assessments}
                  </td>
                  <td className="px-5 py-3.5 text-red-600 dark:text-red-400 tabular-nums font-semibold">
                    {s.distress_count}
                  </td>
                  <td className="px-5 py-3.5 text-green-600 dark:text-green-400 tabular-nums font-semibold">
                    {s.healthy_count}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums">
                    <span
                      className={`font-semibold ${s.distress_rate >= 0.7 ? "text-red-600" : s.distress_rate >= 0.4 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {(s.distress_rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-400 font-mono text-xs tabular-nums">
                    {s.avg_current_ratio.toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-400 font-mono text-xs tabular-nums">
                    {s.avg_debt_to_assets.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
