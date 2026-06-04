"use client";

import React from "react";
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
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstitutionalChartsProps {
  distrib: any[];
  modelChartData: any[];
  scaleChartData: any[];
  isAnalyst?: boolean;
}

export default function InstitutionalCharts({
  distrib,
  modelChartData,
  scaleChartData,
  isAnalyst,
}: InstitutionalChartsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk distribution donut */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
            Risk Distribution
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Breakdown of all assessments by risk tier
          </p>

          {distrib.every((d) => d.value === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm",
                  isAnalyst
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
                )}
              >
                <BarChart3 size={20} />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                No Data Yet
              </p>
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
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
            Model Usage Comparison
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Healthy vs distress outcomes per ML model
          </p>

          {modelChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm",
                  isAnalyst
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
                )}
              >
                <BarChart3 size={20} />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                No Model Data Yet
              </p>
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
                  barSize={32}
                />
                <Bar
                  dataKey="Distress"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Business Scale Distribution */}
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-1">
            Business Scale Segmentation
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            Distress patterns across small vs medium scale SMEs
          </p>

          {scaleChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm",
                  isAnalyst
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500"
                )}
              >
                <BarChart3 size={20} />
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                No Business Scale Data
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={scaleChartData}
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
                  barSize={32}
                />
                <Bar
                  dataKey="Distress"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Empty placeholder or future metric */}
        <div className="bg-white/30 dark:bg-white/5 border border-dashed border-white/20 dark:border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center opacity-60">
          <BarChart3
            size={24}
            className="text-gray-300 dark:text-zinc-600 mb-3"
          />
          <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">
            Additional scale-based longitudinal <br /> insights will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
