"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  shapValues: Record<string, number>;
}

// Human-readable labels for ratio keys
const RATIO_LABELS: Record<string, string> = {
  current_ratio:      "Current Ratio",
  quick_ratio:        "Quick Ratio",
  cash_ratio:         "Cash Ratio",
  debt_to_equity:     "Debt to Equity",
  debt_to_assets:     "Debt to Assets",
  interest_coverage:  "Interest Coverage",
  net_profit_margin:  "Net Profit Margin",
  return_on_assets:   "Return on Assets",
  return_on_equity:   "Return on Equity",
  asset_turnover:     "Asset Turnover",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const impact = value > 0 ? "↑ Increases distress risk" : "↓ Reduces distress risk";
  const color  = value > 0 ? "text-red-600" : "text-green-600";
  return (
    <div className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-gray-800 dark:text-zinc-100 mb-0.5">{name}</p>
      <p className="text-gray-500 dark:text-zinc-400 mb-0.5">
        SHAP: <span className="font-mono font-semibold">{value.toFixed(4)}</span>
      </p>
      <p className={`font-medium ${color}`}>{impact}</p>
    </div>
  );
}

export function SHAPChart({ shapValues }: Props) {
  const data = Object.entries(shapValues)
    .map(([key, value]) => ({
      key,
      name: RATIO_LABELS[key] ?? key,
      value,
      abs: Math.abs(value),
    }))
    .sort((a, b) => b.abs - a.abs); // sort by absolute impact

  const allZero = data.every((d) => d.value === 0);

  if (allZero) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-zinc-500">
        SHAP values unavailable — ML models not yet trained.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(109,40,217,0.04)" }} />
        <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1.5} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell
              key={entry.key}
              fill={entry.value > 0 ? "#ef4444" : "#22c55e"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
