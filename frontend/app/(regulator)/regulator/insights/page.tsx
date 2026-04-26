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

// ── Custom Tooltip for ratio chart ───────────────────────────────────────────

function RatioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-md px-3.5 py-2.5 text-xs min-w-[180px]">
      <p className="font-semibold text-gray-700 dark:text-zinc-200 mb-2">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 mb-0.5"
        >
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.fill }}
            />
            {entry.name}
          </span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: entry.fill }}
          >
            {Number(entry.value).toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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

  // ── Chart data transforms ──────────────────────────────────────────────────

  const sectorChartData = sectors.map((s) => ({
    name: s.industry.length > 14 ? s.industry.slice(0, 14) + "…" : s.industry,
    fullName: s.industry,
    "Distress Rate": parseFloat((s.distress_rate * 100).toFixed(1)),
    Assessments: s.total_assessments,
  }));

  // Clean grouped bar chart mapping
  const ratioChartData = ratios.map((r) => ({
    name: RATIO_LABELS[r.ratio_name] ?? r.ratio_name,
    // instructions from temp.txt: Both render on positive axis for direct magnitude comparison.
    // Use raw values but render as positive bars to keep grouped layout clean.
    Distressed: parseFloat(Math.abs(r.distressed_avg).toFixed(4)),
    Healthy: parseFloat(Math.abs(r.healthy_avg).toFixed(4)),
    // Raw values for Tooltip
    rawDist: r.distressed_avg,
    rawHealth: r.healthy_avg
  }));

  const trendChartData = trends.map((t) => ({
    period: t.period,
    "Distress Rate": parseFloat((t.distress_rate * 100).toFixed(1)),
    Assessments: t.total_assessments,
  }));

  // Robust data guard
  const hasDistressedData = ratios.some(r => r.distressed_avg !== 0);
  const hasHealthyData = ratios.some(r => r.healthy_avg !== 0);
  const canCompare = hasDistressedData && hasHealthyData;

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

      {/* ── Distress by Sector ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Distress Rate by Sector
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Percentage of assessments classified as distressed per industry
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
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" />
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

      {/* ── Financial Ratio Benchmarks — CLEAN GROUPED BAR CHART ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Financial Ratio Benchmarks
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Average ratio values for Distressed vs Healthy SMEs. Values are displayed by absolute magnitude for direct side-by-side comparison.
        </p>

        {!canCompare ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 bg-gray-50/50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
              <BarChart3 size={18} className="text-gray-300 dark:text-zinc-600" />
            </div>
            <div className="text-center space-y-1 px-8">
              <p className="text-sm font-bold text-gray-400 dark:text-zinc-500">
                Benchmark Comparison Unavailable
              </p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed max-w-[320px]">
                The system requires at least one **Healthy** and one **Distressed** prediction to generate benchmark bars.
                {!hasDistressedData && " Currently, zero predictions have been classified as Distressed."}
                {!hasHealthyData && " Currently, zero predictions have been classified as Healthy."}
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={ratioChartData}
              layout="vertical"
              margin={{ top: 4, right: 30, left: 100, bottom: 4 }}
              barGap={2}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f3f4f6"
                className="dark:opacity-[0.06]"
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
                width={96}
              />
              <Tooltip 
                formatter={(v: any, name: string, entry: any) => {
                  const val = name === "Distressed" ? entry.payload.rawDist : entry.payload.rawHealth;
                  return [val.toFixed(3), name];
                }}
                contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }} 
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                formatter={(value) => <span className="text-gray-600 dark:text-zinc-400">{value}</span>}
              />
              <Bar
                dataKey="Distressed"
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                barSize={12}
              />
              <Bar
                dataKey="Healthy"
                fill="#22c55e"
                radius={[0, 4, 4, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Interpretation note */}
        {canCompare && (
          <div className="mt-4 px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed border border-gray-100 dark:border-zinc-800/50">
            <strong className="text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-tight text-[9px] block mb-1">Interpretation Guidance</strong>
            Ratios where the Distressed bar exceeds Healthy (e.g. Debt/Equity) indicate higher risk exposure. Grouped bars help identify which financial indicators diverge most significantly in the Zambian context.
          </div>
        )}
      </div>

      {/* ── Systemic Distress Trend ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Systemic Distress Trend
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Monthly distress rate across all assessments (last 12 months)
        </p>
        {trendChartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
            No trend data available yet
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

      {/* ── Detailed Sector Table ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
            Detailed Sector Breakdown
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            All figures are anonymised aggregates — no company-level data
            included
          </p>
        </div>
        {sectors.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-sm text-gray-300 dark:text-zinc-600">
            No sector data available yet
          </div>
        ) : (
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
                {sectors.map((s, i) => (
                  <tr
                    key={`${s.industry}-${i}`}
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
                        className={`font-semibold ${
                          s.distress_rate >= 0.7
                            ? "text-red-600"
                            : s.distress_rate >= 0.4
                              ? "text-amber-600"
                              : "text-green-600"
                        }`}
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
        )}
      </div>
    </div>
  );
}
