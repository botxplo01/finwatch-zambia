"use client";

/**
 * FinWatch Zambia - Prediction Result Display
 *
 * Displays prediction results with risk gauge, model info, SHAP chart,
 * and AI-generated narrative for SME assessments.
 */

import { CheckCircle2, AlertTriangle, TrendingUp, FileText, RotateCcw } from "lucide-react";
import { SHAPChart } from "./SHAPChart";

interface Narrative {
  content: string;
  source: string;
}

interface PredictionResponse {
  id: number;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  shap_values: Record<string, number>;
  predicted_at: string;
  narrative: Narrative | null;
}

interface Props {
  result: PredictionResponse;
  companyName: string;
  onRunAnother: () => void;
}

function RiskGauge({ probability }: { probability: number }) {
  const pct    = Math.round(probability * 100);
  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  // Only draw the top half (180°)
  const halfCirc = Math.PI * radius;
  const offset   = halfCirc - (pct / 100) * halfCirc;

  const color =
    pct >= 70 ? "#ef4444" :
    pct >= 40 ? "#f59e0b" :
                "#22c55e";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Track */}
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * halfCirc} ${halfCirc}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Percentage label */}
        <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {pct}%
        </text>
      </svg>
      <div className="flex justify-between w-full text-[10px] text-gray-400 dark:text-zinc-500 px-2">
        <span>0% Healthy</span>
        <span>100% Distressed</span>
      </div>
    </div>
  );
}

function sourceBadge(source: string) {
  const map: Record<string, { label: string; color: string }> = {
    groq:     { label: "Groq AI",   color: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800" },
    ollama:   { label: "Ollama",    color: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
    template: { label: "Template",  color: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" },
  };
  const { label, color } = map[source] ?? map.template;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {label}
    </span>
  );
}

export function PredictionResult({ result, companyName, onRunAnother }: Props) {
  const pct       = Math.round(result.distress_probability * 100);
  const isHigh    = pct >= 70;
  const isMedium  = pct >= 40 && pct < 70;
  const isHealthy = pct < 40;

  const riskColor =
    isHigh    ? "text-red-600 dark:text-red-400" :
    isMedium  ? "text-amber-600 dark:text-amber-400" :
                "text-green-600 dark:text-green-400";

  const riskBg =
    isHigh    ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" :
    isMedium  ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" :
                "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";

  const RiskIcon = isHealthy ? CheckCircle2 : AlertTriangle;

  return (
    <div className="space-y-4">

      {/* Header banner */}
      <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${riskBg}`}>
        <RiskIcon size={20} className={`${riskColor} flex-shrink-0 mt-0.5`} />
        <div>
          <p className={`text-sm font-bold ${riskColor}`}>{result.risk_label}</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {companyName} · {result.model_used === "random_forest" ? "Random Forest" : "Logistic Regression"} ·{" "}
            {new Date(result.predicted_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={onRunAnother}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
        >
          <RotateCcw size={11} />
          New
        </button>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Risk gauge */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-purple-600" />
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Distress Probability
            </h3>
          </div>
          <RiskGauge probability={result.distress_probability} />
        </div>

        {/* Model info */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={14} className="text-purple-600" />
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Assessment Summary
            </h3>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Company",     value: companyName },
              { label: "Model",       value: result.model_used === "random_forest" ? "Random Forest" : "Logistic Regression" },
              { label: "Risk Level",  value: result.risk_label },
              { label: "Probability", value: `${pct}%` },
              { label: "Prediction ID", value: `#${result.id}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400 dark:text-zinc-500">{label}</span>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-100 font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SHAP Chart */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              SHAP Feature Attributions
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
              Red bars increase distress risk · Green bars reduce it
            </p>
          </div>
        </div>
        <SHAPChart shapValues={result.shap_values} />
      </div>

      {/* NLP Narrative */}
      {result.narrative && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Financial Health Narrative
            </h3>
            {sourceBadge(result.narrative.source)}
          </div>
          <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
            {result.narrative.content}
          </p>
        </div>
      )}
    </div>
  );
}
