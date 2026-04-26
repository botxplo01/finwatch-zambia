"use client";

/**
 * FinWatch Zambia - Regulator Sector Insights
 *
 * Industry-level distress patterns, financial ratio benchmarks,
 * and temporal trends across all assessed SMEs.
 */

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
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
  net_profit_margin: "Net Margin",
  return_on_assets: "ROA",
  return_on_equity: "ROE",
  asset_turnover: "Asset Turnover",
};

// Clamp extreme outliers so one ratio doesn't dominate the x-axis.
// Values beyond ±CLAMP are capped; the tooltip still shows the real value.
const CLAMP = 4.0;
function clamp(v: number) {
  return Math.max(-CLAMP, Math.min(CLAMP, v));
}

// Custom Tooltip

function RatioTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-md px-3.5 py-2.5 text-xs min-w-[190px]">
      <p className="font-semibold text-gray-700 dark:text-zinc-200 mb-2">
        {label}
      </p>
      {payload.map((entry: any) => {
        // entry.value is the clamped value; entry.payload has originals
        const real =
          entry.name === "Distressed"
            ? entry.payload.distressedReal
            : entry.payload.healthyReal;
        const clamped = entry.value !== real;
        return (
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
              {real.toFixed(3)}
              {clamped && (
                <span className="ml-1 text-gray-300 dark:text-zinc-600 font-normal">
                  (capped)
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Page

export default function InsightsPage() {
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [ratios, setRatios] = useState<RatioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
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
    load();
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

  // Chart data

  const sectorChartData = sectors.map((s) => ({
    name: s.industry.length > 15 ? s.industry.slice(0, 15) + "…" : s.industry,
    "Distress Rate": parseFloat((s.distress_rate * 100).toFixed(1)),
  }));

  const trendChartData = trends.map((t) => ({
    period: t.period,
    "Distress Rate": parseFloat((t.distress_rate * 100).toFixed(1)),
  }));

  // Check data availability for the ratio chart
  const hasDistressedData = ratios.some((r) => r.distressed_avg !== 0);
  const hasHealthyData = ratios.some((r) => r.healthy_avg !== 0);
  const hasBothGroups = hasDistressedData && hasHealthyData;

  // Build ratio chart data - clamp outliers, preserve originals for tooltip
  const ratioChartData = ratios.map((r) => ({
    name: RATIO_LABELS[r.ratio_name] ?? r.ratio_name,
    Distressed: clamp(r.distressed_avg),
    Healthy: clamp(r.healthy_avg),
    distressedReal: r.distressed_avg,
    healthyReal: r.healthy_avg,
  }));

  return (
    <div className="p-6 pb-20 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
          Sector Insights
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
          Industry-level distress patterns, ratio benchmarks, and temporal
          trends.
        </p>
      </div>

      {/* Distress by Sector */}
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
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              >
                {sectorChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry["Distress Rate"] >= 70
                        ? "#ef4444"
                        : entry["Distress Rate"] >= 40
                          ? "#f59e0b"
                          : "#059669"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Financial Ratio Benchmarks */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
          Financial Ratio Benchmarks
        </h2>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
          Average ratio values for Distressed vs Healthy SMEs. Negative values
          (e.g. interest coverage, profit margin) indicate loss-making or
          over-indebted firms.
        </p>

        {/* Not enough data */}
        {!hasBothGroups ? (
          <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Info size={20} className="text-amber-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
              Comparison requires both groups
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-sm leading-relaxed">
              {!hasDistressedData && !hasHealthyData
                ? "No predictions in the system yet."
                : !hasDistressedData
                  ? "No Distressed predictions found. Run a Logistic Regression prediction on a financially stressed company to populate the Distressed group."
                  : "No Healthy predictions found. Run a prediction on a financially stable company to populate the Healthy group."}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={ratioChartData}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 104, bottom: 16 }}
                barCategoryGap="18%"
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f3f4f6"
                  className="dark:opacity-[0.06]"
                />
                <XAxis
                  type="number"
                  domain={[-CLAMP, CLAMP]}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip content={<RatioTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => (
                    <span className="text-gray-600 dark:text-zinc-400">
                      {value}
                    </span>
                  )}
                />
                {/* Zero reference line */}
                <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Bar
                  dataKey="Distressed"
                  fill="#ef4444"
                  radius={[0, 3, 3, 0]}
                  barSize={11}
                />
                <Bar
                  dataKey="Healthy"
                  fill="#22c55e"
                  radius={[0, 3, 3, 0]}
                  barSize={11}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Legend / key */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/10 rounded-xl text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-semibold text-red-600 dark:text-red-400">
                  Distressed SMEs
                </span>{" "}
                — higher Debt/Equity and Debt/Assets; lower or negative
                liquidity and profitability ratios.
              </div>
              <div className="px-3 py-2.5 bg-green-50 dark:bg-green-900/10 rounded-xl text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  Healthy SMEs
                </span>{" "}
                — higher current/quick ratios and interest coverage; lower
                leverage ratios.
              </div>
            </div>
            {ratios.some(
              (r) =>
                Math.abs(r.distressed_avg) > CLAMP ||
                Math.abs(r.healthy_avg) > CLAMP,
            ) && (
              <p className="mt-2 text-[10px] text-gray-300 dark:text-zinc-600">
                * Some values exceed the chart range of ±{CLAMP} and are capped
                for readability. Hover for exact values.
              </p>
            )}
          </>
        )}
      </div>

      {/* Systemic Distress Trend */}
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

      {/* Detailed Sector Table */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
            Detailed Sector Breakdown
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            All figures are anonymised aggregates
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
        )}
      </div>
    </div>
  );
}
