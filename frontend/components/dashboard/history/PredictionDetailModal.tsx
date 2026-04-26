"use client";

/**
 * FinWatch Zambia - Prediction Detail Modal
 *
 * Modal displaying full prediction details including risk level, financial ratios,
 * SHAP chart, and AI-generated narrative for historical predictions.
 */

import { useEffect, useState } from "react";
import {
  X,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Loader2,
  MessageSquare,
} from "lucide-react";
import api from "@/lib/api";
import SHAPChart from "@/components/dashboard/predict/SHAPChart";

// Types

interface NarrativeDetail {
  content: string; // backend field name is "content", not "text"
  source:       "groq" | "ollama" | "template";
  // generated_at is not returned by backend - omitted
}

interface RatioFeatureDetail {
  current_ratio:      number | null;
  quick_ratio:        number | null;
  cash_ratio:         number | null;
  debt_to_equity:     number | null;
  debt_to_assets:     number | null;
  interest_coverage:  number | null;
  net_profit_margin:  number | null;
  return_on_assets:   number | null;
  return_on_equity:   number | null;
  asset_turnover:     number | null;
}

interface PredictionDetail {
  id:                   number;
  model_used:           string;
  risk_label: string; // backend: "risk_label", not "prediction_label"
  distress_probability: number;
  shap_values: Record<string, number>; // backend returns dict, not array
  predicted_at: string; // backend: "predicted_at", not "created_at"
  ratios:               RatioFeatureDetail | null;
  narrative:            NarrativeDetail | null;
  // company_name and period come from the summary list, not the detail endpoint
}

interface Props {
  predictionId: number;
  companyName:  string;  // passed from parent since detail endpoint doesn't include it
  period:       string;  // passed from parent
  onClose:      () => void;
}

// Helpers

const RATIO_LABELS: Record<string, string> = {
  current_ratio:     "Current Ratio",
  quick_ratio:       "Quick Ratio",
  cash_ratio:        "Cash Ratio",
  debt_to_equity:    "Debt-to-Equity",
  debt_to_assets:    "Debt-to-Assets",
  interest_coverage: "Interest Coverage",
  net_profit_margin: "Net Profit Margin",
  return_on_assets:  "Return on Assets",
  return_on_equity:  "Return on Equity",
  asset_turnover:    "Asset Turnover",
};

const SOURCE_BADGE: Record<string, { label: string; classes: string }> = {
  groq: {
    label:   "Groq AI",
    classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  ollama: {
    label:   "Ollama",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  template: {
    label:   "Template",
    classes: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

function riskMeta(prob: number): { text: string; color: string } {
  if (prob >= 0.7) return { text: "High Risk",    color: "text-red-500 dark:text-red-400" };
  if (prob >= 0.4) return { text: "Medium Risk",  color: "text-amber-500 dark:text-amber-400" };
  return              { text: "Low Risk",     color: "text-emerald-500 dark:text-emerald-400" };
}

// Component

export default function PredictionDetailModal({
  predictionId,
  companyName,
  period,
  onClose,
}: Props) {
  const [detail,  setDetail]  = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<PredictionDetail>(`/api/predictions/${predictionId}`);
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled) setError("Failed to load prediction history when switching to history tab.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [predictionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Prediction Detail
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {companyName} &mdash; Period:{" "}
              <span className="font-medium">{period}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading prediction details…</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Risk Level</p>
                  <p className={`text-lg font-bold ${riskMeta(detail.distress_probability).color}`}>
                    {riskMeta(detail.distress_probability).text}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Distress Prob.</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    {(detail.distress_probability * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Model</p>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {detail.model_used === "random_forest" ? "Random Forest" : "Logistic Reg."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Status</p>
                  <div className="flex items-center gap-1.5">
                    {detail.risk_label === "Distressed" ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <p className="text-sm font-semibold text-red-500 dark:text-red-400">Distressed</p>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">Healthy</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial ratios */}
              {detail.ratios && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                    Computed Financial Ratios
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(RATIO_LABELS).map(([key, label]) => {
                      const val = detail.ratios![key as keyof RatioFeatureDetail];
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5 flex justify-between items-center gap-2"
                        >
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{label}</span>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 font-mono">
                            {val !== null && val !== undefined ? Number(val).toFixed(3) : "N/A"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SHAP chart */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                  SHAP Feature Attributions
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                  Red bars increase distress risk · Green bars reduce it
                </p>
                <SHAPChart shapValues={detail.shap_values} />
              </div>

              {/* NLP Narrative */}
              {detail.narrative ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      AI Financial Narrative
                    </h3>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_BADGE[detail.narrative.source]?.classes ?? ""}`}>
                      {SOURCE_BADGE[detail.narrative.source]?.label ?? detail.narrative.source}
                    </span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {detail.narrative.content}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">No narrative available for this prediction.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
