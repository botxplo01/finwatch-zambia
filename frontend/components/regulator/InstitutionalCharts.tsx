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

interface InstitutionalChartsProps {
  distrib: any[];
  modelChartData: any[];
}

export default function InstitutionalCharts({ distrib, modelChartData }: InstitutionalChartsProps) {
  return (
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
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
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
  );
}
