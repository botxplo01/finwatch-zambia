"use client";

/**
 * FinWatch Zambia - Prediction Detail Modal
 *
 * Modal displaying full prediction details including risk level, financial ratios,
 * SHAP chart, and AI-generated narrative for historical predictions.
 * Shows Logistic Regression as the sole SME-facing result.
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
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "@/lib/api";
import SHAPChart from "@/components/sme/predict/SHAPChart";
import { cn, formatDate } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import { getRiskTier } from "@/lib/risk-tiers";
import { RiskGauge } from "@/components/sme/predict/PredictionResult";

interface NarrativeDetail {
  content: string;
  source: string;
}

interface RatioFeatureDetail {
  current_ratio: number | null;
  quick_ratio: number | null;
  cash_ratio: number | null;
  debt_to_equity: number | null;
  debt_to_assets: number | null;
  interest_coverage: number | null;
  net_profit_margin: number | null;
  return_on_assets: number | null;
  return_on_equity: number | null;
  asset_turnover: number | null;
}

interface SingleModelDetail {
  id: number;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  shap_values: Record<string, number>;
  predicted_at: string;
  ratios: RatioFeatureDetail | null;
  narrative: NarrativeDetail | null;
}

interface AssessmentDetail {
  ratio_feature_id: number;
  company_id: number;
  company_name: string;
  period: string;
  assessment_methodology: string;
  models_agree: boolean | null;
  predicted_at: string;
  random_forest: SingleModelDetail | null;
  logistic_regression: SingleModelDetail | null;
}

interface Props {
  ratioFeatureId: number;
  companyName: string;
  period: string;
  onClose: () => void;
}

const RATIO_LABELS: Record<string, string> = {
  current_ratio: "Current Ratio",
  quick_ratio: "Quick Ratio",
  cash_ratio: "Cash Ratio",
  debt_to_equity: "Debt-to-Equity",
  debt_to_assets: "Debt-to-Assets",
  interest_coverage: "Interest Coverage",
  net_profit_margin: "Net Profit Margin",
  return_on_assets: "Return on Assets",
  return_on_equity: "Return on Equity",
  asset_turnover: "Asset Turnover",
};

const SOURCE_BADGE: Record<string, { label: string; classes: string }> = {
  groq: {
    label: "Groq AI",
    classes:
      "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  openrouter: {
    label: "OpenRouter AI",
    classes: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  template: {
    label: "Template",
    classes: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

function riskMeta(prob: number): { text: string; color: string } {
  const tier = getRiskTier(prob);
  if (tier === "High")
    return { text: "High Risk", color: "text-red-500 dark:text-red-400" };
  if (tier === "Medium")
    return { text: "Medium Risk", color: "text-amber-500 dark:text-amber-400" };
  return { text: "Low Risk", color: "text-emerald-500 dark:text-emerald-400" };
}

/**
 * Strips LLM-generated document-title heading lines from the top of a
 * narrative string (e.g. "# Financial Health Assessment – 2020 Q1").
 */
function stripNarrativeHeader(content: string): string {
  return content
    .split("\n")
    .filter((line, idx) => {
      if (idx > 4) return true;
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("#")) return false;
      const lower = trimmed.toLowerCase();
      if (
        lower.startsWith("financial health assessment") ||
        lower.startsWith("zambian enterprise") ||
        lower.startsWith("financial health narrative") ||
        lower.startsWith("ai financial narrative")
      )
        return false;
      return true;
    })
    .join("\n")
    .trimStart();
}

// Component

export default function PredictionDetailModal({
  ratioFeatureId,
  companyName,
  period,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showPrimaryNarrative, setShowPrimaryNarrative] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<AssessmentDetail>(
          `/api/predictions/assessment/${ratioFeatureId}`
        );
        if (!cancelled) setDetail(res.data);
      } catch {
        if (!cancelled)
          setError("Failed to load prediction details. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ratioFeatureId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // LR is the sole SME-facing model; RF runs in the background for institutional use.
  const primary = detail?.logistic_regression ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleBackdrop}
    >
      <div
        onScroll={(e) => {
          const isScrolled = e.currentTarget.scrollTop > 10;
          if (isScrolled !== scrolled) setScrolled(isScrolled);
        }}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0a0a0a] border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl"
      >
        {/* Header */}
        <div
          className={cn(
            "sticky top-0 z-40 flex items-center justify-between px-6 py-5 border-b transition-all duration-300 rounded-t-2xl",
            scrolled
              ? "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-md"
              : "bg-white dark:bg-[#0a0a0a] border-transparent"
          )}
        >
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
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading prediction details…
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {detail && primary && !loading && (
            <>


              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Risk Level
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      riskMeta(primary.distress_probability).color
                    }`}
                  >
                    {riskMeta(primary.distress_probability).text}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Distress Prob.
                  </p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    {(primary.distress_probability * 100).toFixed(1)}%
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Model
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Logistic Regression
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4 flex flex-col gap-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Status
                  </p>
                  <div className="flex items-center gap-1.5">
                    {primary.risk_label === "Distressed" ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <p className="text-sm font-semibold text-red-500 dark:text-red-400">
                          Distressed
                        </p>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
                          Healthy
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>



              {/* Financial ratios */}
              {primary.ratios && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                    Computed Financial Ratios
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(RATIO_LABELS).map(([key, label]) => {
                      const val =
                        primary.ratios![key as keyof RatioFeatureDetail];
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-zinc-100/50 dark:border-zinc-800/50 bg-white/40 dark:bg-white/5 px-3 py-2.5 flex justify-between items-center gap-2"
                        >
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                            {label}
                          </span>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 shrink-0 font-mono">
                            {val !== null && val !== undefined
                              ? Number(val).toFixed(3)
                              : "N/A"}
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
                <SHAPChart shapValues={primary.shap_values} />
              </div>

              {/* AI Narrative — collapsible & open by default */}
              {primary.narrative ? (
                <div className="border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl overflow-hidden bg-white/40 dark:bg-white/5">
                  <button
                    onClick={() => setShowPrimaryNarrative((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        AI Financial Narrative
                      </h3>
                      <span
                        className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
                          SOURCE_BADGE[primary.narrative.source]?.classes ?? 
                          "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                        }`}
                      >
                        {SOURCE_BADGE[primary.narrative.source]?.label ??
                          primary.narrative.source}
                      </span>
                    </div>
                    {showPrimaryNarrative ? (
                      <ChevronUp size={16} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                    )}
                  </button>
                  {showPrimaryNarrative && (
                    <div className="px-5 pb-5 pt-3 border-t border-zinc-100/50 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
                       <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                         {companyName} · Logistic Regression · {formatDate(primary.predicted_at)}
                       </p>
                      <FormattedMessage
                        content={stripNarrativeHeader(primary.narrative.content)}
                        className="text-zinc-700 dark:text-zinc-300"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/40 dark:bg-white/5 border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-500 dark:text-zinc-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">
                    No narrative available for this prediction.
                  </p>
                </div>
              )}


            </>
          )}
        </div>
      </div>
    </div>
  );
}
