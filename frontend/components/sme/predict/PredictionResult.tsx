"use client";

/**
 * FinWatch Zambia - Prediction Result Display
 *
 * Displays a dual-model assessment with Random Forest as the primary result and
 * Logistic Regression available as a collapsible secondary comparison. Shows a
 * plain-language disagreement banner when the two models return conflicting labels.
 */

import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  RotateCcw,
  Zap,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SHAPChart } from "./SHAPChart";
import { useState } from "react";
import api from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Narrative {
  content: string;
  source: string;
}

/** Shape of a single model's prediction within an AssessmentResponse. */
interface SingleModelResult {
  id: number;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  shap_values: Record<string, number>;
  predicted_at: string;
  assessment_methodology: string;
  narrative: Narrative | null;
}

/** AssessmentResponse shape returned by POST /api/predictions/ */
interface AssessmentResponse {
  ratio_feature_id: number;
  company_id: number;
  company_name: string;
  period: string;
  assessment_methodology: string;
  models_agree: boolean | null;
  predicted_at: string;
  random_forest: SingleModelResult | null;
  logistic_regression: SingleModelResult | null;
}

interface Props {
  result: AssessmentResponse;
  companyName: string;
  onRunAnother: () => void;
  onPreview: () => void;
  isIndicative?: boolean;
  businessScale?: "small_scale" | "medium_scale" | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskGauge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const halfCirc = Math.PI * radius;
  const offset = halfCirc - (pct / 100) * halfCirc;

  const color = pct >= 70 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#22c55e";

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
        <text
          x="70"
          y="66"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill={color}
        >
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
    groq: {
      label: "Groq AI",
      color:
        "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    },
    template: {
      label: "Template",
      color:
        "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    },
  };
  const { label, color } = map[source] ?? map.template;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ModelSection — renders a single model's risk gauge, SHAP chart, and narrative
// ---------------------------------------------------------------------------

interface ModelSectionProps {
  model: SingleModelResult;
  businessScale?: "small_scale" | "medium_scale" | null;
  isSecondary?: boolean;
}

function ModelSection({ model, businessScale, isSecondary }: ModelSectionProps) {
  const pct = Math.round(model.distress_probability * 100);
  const isHigh = pct >= 70;
  const isMedium = pct >= 40 && pct < 70;
  const isHealthy = pct < 40;

  const riskColor = isHigh
    ? "text-red-600 dark:text-red-400"
    : isMedium
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";

  const RiskIcon = isHealthy ? CheckCircle2 : AlertTriangle;

  return (
    <div className={cn("space-y-4", isSecondary && "opacity-90")}>
      {/* Inline risk indicator for secondary section */}
      {isSecondary && (
        <div className="flex items-center gap-2 pb-1">
          <RiskIcon size={15} className={riskColor} />
          <p className={cn("text-sm font-bold", riskColor)}>{model.risk_label}</p>
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            · {pct}% distress probability
          </span>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk gauge */}
        <div
          className={cn(
            "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5",
            isSecondary && "border-gray-100/60 dark:border-zinc-800/60"
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-purple-600" />
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Distress Probability
            </h3>
          </div>
          <RiskGauge probability={model.distress_probability} />
        </div>

        {/* Narrative */}
        {model.narrative && (
          <div
            className={cn(
              "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5",
              isSecondary && "border-gray-100/60 dark:border-zinc-800/60"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
                Financial Health Narrative
              </h3>
              {sourceBadge(model.narrative.source)}
            </div>
            <FormattedMessage
              content={model.narrative.content}
              className={isSecondary ? "prose-xs" : undefined}
            />
          </div>
        )}
      </div>

      {/* SHAP Chart */}
      <div
        className={cn(
          "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5",
          isSecondary && "border-gray-100/60 dark:border-zinc-800/60"
        )}
      >
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
        <SHAPChart shapValues={model.shap_values} businessScale={businessScale} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictionResult — main export
// ---------------------------------------------------------------------------

export function PredictionResult({
  result,
  companyName,
  onRunAnother,
  onPreview,
  isIndicative,
  businessScale,
}: Props) {
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [loadingInterpretation, setLoadingInterpretation] = useState(false);
  const [showLR, setShowLR] = useState(false);

  // Primary model: prefer Random Forest, fall back to Logistic Regression
  const primary = result.random_forest ?? result.logistic_regression;
  const rfMissing = result.random_forest === null && result.logistic_regression !== null;

  // Interpretation uses the primary model's own Prediction id (not ratio_feature_id)
  const primaryId = primary?.id ?? null;

  const handleGetInterpretation = async () => {
    if (interpretation) {
      setShowInterpretation(!showInterpretation);
      return;
    }
    if (!primaryId) return;
    setLoadingInterpretation(true);
    try {
      const res = await api.get(`/api/predictions/${primaryId}/summary`);
      setInterpretation(res.data.summary);
      setShowInterpretation(true);
    } catch (err) {
      console.error("Failed to fetch interpretation", err);
    } finally {
      setLoadingInterpretation(false);
    }
  };

  if (!primary) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
        Assessment data is unavailable. Please try running the prediction again.
      </div>
    );
  }

  const pct = Math.round(primary.distress_probability * 100);
  const isHigh = pct >= 70;
  const isMedium = pct >= 40 && pct < 70;
  const isHealthy = pct < 40;

  const riskColor = isHigh
    ? "text-red-600 dark:text-red-400"
    : isMedium
    ? "text-amber-600 dark:text-amber-400"
    : "text-green-600 dark:text-green-400";

  const riskBg = isHigh
    ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
    : isMedium
    ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
    : "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";

  const RiskIcon = isHealthy ? CheckCircle2 : AlertTriangle;

  return (
    <div className="space-y-4">
      {/* Indicative notice */}
      {isIndicative && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-tight">
              Indicative Assessment
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed mt-0.5">
              This assessment is based on estimated inputs. For a more accurate
              result, complete the full financial form.
            </p>
          </div>
        </div>
      )}

      {/* RF unavailable notice */}
      {rfMissing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-tight">
              Random Forest Unavailable
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed mt-0.5">
              The Random Forest model was unavailable for this assessment. Results
              below are from the Logistic Regression model.
            </p>
          </div>
        </div>
      )}

      {/* Header banner */}
      <div className={`flex flex-col gap-4 px-5 py-5 rounded-2xl border ${riskBg}`}>
        <div className="flex items-start gap-3">
          <RiskIcon size={20} className={`${riskColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${riskColor}`}>{primary.risk_label}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {companyName} · Random Forest · {formatDate(primary.predicted_at)}
            </p>
          </div>
          <button
            onClick={onRunAnother}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
          >
            <RotateCcw size={11} />
            New
          </button>
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-black/5 dark:border-white/5">
          <button
            onClick={handleGetInterpretation}
            disabled={loadingInterpretation}
            className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-all group"
          >
            {loadingInterpretation ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap
                size={14}
                className={cn(
                  "transition-transform group-hover:scale-110",
                  showInterpretation && "fill-current"
                )}
              />
            )}
            {showInterpretation
              ? "Hide Interpretation"
              : "What does this mean for me?"}
          </button>

          <button
            onClick={onPreview}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-all group"
          >
            <FileText
              size={14}
              className="group-hover:scale-110 transition-transform"
            />
            Preview Full Report
          </button>
        </div>

        {showInterpretation && interpretation && (
          <div className="mt-1 p-4 rounded-xl bg-white/50 dark:bg-black/20 border border-purple-100 dark:border-purple-900/30 animate-in fade-in slide-in-from-top-1 duration-300">
            <FormattedMessage
              content={interpretation}
              className="italic text-gray-700 dark:text-zinc-300 prose-xs"
            />
          </div>
        )}
      </div>

      {/* Disagreement banner — only when models explicitly disagree */}
      {result.models_agree === false && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
            Our two models disagree on this result, which can happen when a
            business has an unusual mix of financial indicators. Review both
            results, and consider this a signal to look more closely rather than
            a final answer.
          </p>
        </div>
      )}

      {/* Assessment summary info card + primary gauge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk gauge */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-purple-600" />
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Distress Probability
            </h3>
          </div>
          <RiskGauge probability={primary.distress_probability} />
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
              { label: "Company", value: companyName },
              { label: "Risk Level", value: primary.risk_label },
              {
                label: "Type",
                value: isIndicative ? "Indicative" : "Financial",
              },
              { label: "Probability", value: `${pct}%` },
              { label: "Assessment ID", value: `#${result.ratio_feature_id}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {label}
                </span>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-100 font-mono">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SHAP Chart — primary model */}
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
        <SHAPChart
          shapValues={primary.shap_values}
          businessScale={businessScale}
        />
      </div>

      {/* NLP Narrative — primary model */}
      {primary.narrative && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wide">
              Financial Health Narrative
            </h3>
            {sourceBadge(primary.narrative.source)}
          </div>
          <FormattedMessage content={primary.narrative.content} />
        </div>
      )}

      {/* Collapsible Logistic Regression comparison */}
      {result.logistic_regression && (
        <div className="border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowLR((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300 uppercase tracking-wide">
              Compare with Logistic Regression
            </span>
            {showLR ? (
              <ChevronUp size={16} className="text-gray-400 dark:text-zinc-500" />
            ) : (
              <ChevronDown size={16} className="text-gray-400 dark:text-zinc-500" />
            )}
          </button>

          {showLR && (
            <div className="px-5 pb-5 pt-3 bg-white dark:bg-zinc-900 border-t border-gray-50 dark:border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <ModelSection
                model={result.logistic_regression}
                businessScale={businessScale}
                isSecondary
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
