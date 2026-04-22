"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  BarChart3,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "@/lib/api";
import { getRegAuthHeader } from "@/lib/regulator-auth";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
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
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-0.5">
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
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RegulatorDashboard() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [modelPerf, setModelPerf] = useState<ModelPerfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAll() {
      const headers = getRegAuthHeader();
      try {
        const [ovRes, secRes, modRes] = await Promise.all([
          api.get("/api/regulator/overview", { headers }),
          api.get("/api/regulator/sectors", { headers }),
          api.get("/api/regulator/model-performance", { headers }),
        ]);
        setOverview(ovRes.data);
        setSectors(secRes.data.slice(0, 6));
        setModelPerf(modRes.data);
      } catch {
        setError("Failed to load regulator data. Check your session.");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-full py-32">
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

  return (
    <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
            System Overview
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            Aggregate, anonymised financial distress intelligence across all
            Zambian SMEs assessed.
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

      {/* ── KPI Cards ── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Total Assessments"
            value={overview.total_assessments}
            sub="Across all companies"
            icon={<BarChart3 size={18} className="text-purple-600" />}
            accent="bg-purple-50 dark:bg-purple-900/20"
          />
          <KPICard
            label="Companies Assessed"
            value={overview.total_companies}
            sub={`${overview.sectors_covered} sectors covered`}
            icon={<Building2 size={18} className="text-blue-600" />}
            accent="bg-blue-50 dark:bg-blue-900/20"
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
            icon={<Activity size={18} className="text-emerald-600" />}
            accent="bg-emerald-50 dark:bg-emerald-900/20"
          />
        </div>
      )}

      {/* ── Two column: risk distribution + model performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk distribution donut */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
            Risk Distribution
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Breakdown of all assessments by risk tier
          </p>

          {distrib.every((d) => d.value === 0) ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
              No assessment data yet
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={distrib}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {distrib.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid #f3f4f6",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {distrib.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: d.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800 dark:text-zinc-100">
                        {d.name}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                        {d.value} assessments
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Model performance */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
            Model Usage Comparison
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Healthy vs distress outcomes per ML model
          </p>

          {modelChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-300 dark:text-zinc-600">
              No model data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={modelChartData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
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
                <Bar
                  dataKey="Healthy"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="Distress"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Sector table ── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
            Top Sectors by Distress Rate
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            Sectors with fewer than 3 assessments are suppressed for privacy
          </p>
        </div>

        {sectors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <ShieldCheck
              size={24}
              className="text-gray-200 dark:text-zinc-700"
            />
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              No sector data yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {sectors.map((s, i) => {
                  const isHigh = s.distress_rate >= 0.7;
                  const isMed = s.distress_rate >= 0.4;
                  return (
                    <tr
                      key={s.industry}
                      className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{
                              background:
                                SECTOR_COLORS[i % SECTOR_COLORS.length],
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
                              className={`h-full rounded-full ${isHigh ? "bg-red-500" : isMed ? "bg-amber-400" : "bg-green-500"}`}
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isHigh
                              ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                              : isMed
                                ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                : "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                          }`}
                        >
                          {isHigh ? "High" : isMed ? "Medium" : "Low"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
