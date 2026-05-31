"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TimeRange = "7d" | "30d" | "3mo";

interface DashboardChartProps {
  data: any[];
  timeRange: TimeRange;
  TooltipContent: React.ComponentType<any>;
}

export default function DashboardChart({
  data,
  timeRange,
  TooltipContent,
}: DashboardChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillHealthy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillDistress" x1="0" y1="0" x2="0" y2="1">
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
          interval={timeRange === "7d" ? 0 : timeRange === "30d" ? 4 : 14}
        />
        <YAxis hide />
        <RechartsTooltip
          content={<TooltipContent />}
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
  );
}
