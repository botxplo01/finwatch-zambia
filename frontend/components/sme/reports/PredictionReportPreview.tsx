"use client";

/**
 * FinWatch Zambia - SME Assessment Report Preview
 *
 * High-fidelity interactive preview of a dual-model assessment.
 * Displays the Random Forest result as the primary outcome and
 * Logistic Regression as a collapsible secondary comparison.
 * Mirrors the section structure of the generated PDF report.
 */

import { useState } from "react";
import {
  FileText,
  ShieldCheck,
  TrendingUp,
  Search,
  BrainCircuit,
  ArrowRight,
  Info,
  Calendar,
  Building,
  Target,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";
import { ReportEmptyState } from "@/components/shared/ReportEmptyState";

// Types

interface Narrative {
  content: string;
  source: string;
}

interface SingleModelResult {
  id: number;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  shap_values: Record<string, number>;
  ratios?: Record<string, number>;
  predicted_at: string;
  assessment_methodology: string;
  narrative: Narrative | null;
}

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
  ratios?: Record<string, number>;
}

interface PredictionReportPreviewProps {
  assessment: AssessmentResponse | null;
  onClose?: () => void;
}

/**
 * PredictionReportPreview
 *
 * A high-fidelity, interactive preview of an SME dual-model health assessment.
 * Mirrors the professional PDF layout with SME-specific purple branding.
 */
export function PredictionReportPreview({
  assessment,
  onClose,
}: PredictionReportPreviewProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showLR, setShowLR] = useState(false);

  if (!assessment) return <ReportEmptyState portalType="sme" />;

  // Primary model: prefer Random Forest, fall back to Logistic Regression
  const primary = assessment.random_forest ?? assessment.logistic_regression;

  if (!primary) return <ReportEmptyState portalType="sme" />;

  // Secondary model is always LR (null when RF is the only available model)
  const secondary =
    assessment.random_forest && assessment.logistic_regression
      ? assessment.logistic_regression
      : null;

  // Which model is acting as primary — for the "via ..." micro-label
  const primaryModelName =
    assessment.random_forest ? "Random Forest" : "Logistic Regression";

  // One of the two models didn't complete
  const rfMissing =
    assessment.random_forest === null && assessment.logistic_regression !== null;
  const lrMissing =
    assessment.logistic_regression === null && assessment.random_forest !== null;

  // Ratios live on the assessment envelope (shared financial inputs), with
  // per-model ratios as a fallback for legacy shapes.
  const ratios = assessment.ratios ?? primary.ratios ?? {};
  const shapValues = primary.shap_values ?? {};

  const isHealthy = primary.risk_label === "Healthy";
  const statusColor = isHealthy ? "text-emerald-500" : "text-red-500";
  const statusBg = isHealthy ? "bg-emerald-500" : "bg-red-500";

  return (
    <div
      onScroll={(e) => {
        const isScrolled = e.currentTarget.scrollTop > 10;
        if (isScrolled !== scrolled) setScrolled(isScrolled);
      }}
      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-y-auto flex flex-col h-full max-h-[90vh] lg:max-h-[850px] custom-scrollbar relative"
    >
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-10 px-8 py-5 border-b transition-all duration-300 flex items-center justify-between rounded-t-3xl",
          scrolled
            ? "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-md"
            : "bg-white dark:bg-zinc-900 border-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <FileText size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] font-black text-purple-600/60 dark:text-purple-400/60 uppercase tracking-widest leading-none">
              Assessment Preview
            </p>
            <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-tight mt-1">
              Assessment #{assessment.ratio_feature_id?.toString().slice(-6).toUpperCase()}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              )}
            />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {primary.risk_label} Result
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close Preview"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-10 space-y-10">
        {/* Title & Metadata */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight leading-tight">
              Financial Health &amp; Distress <br />
              <span className="text-purple-600 dark:text-purple-400 italic">
                Assessment Report
              </span>
            </h1>
            <div className="h-1.5 w-24 bg-purple-600 rounded-full" />
          </div>

          {/* Model unavailability notices — symmetric by whichever model failed */}
          {rfMissing && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3">
              <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-tight">
                  Random Forest Unavailable
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed mt-0.5">
                  The Random Forest model was unavailable for this assessment.
                  Results below are from the Logistic Regression model.
                </p>
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Building size={16} className="text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    SME Entity
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-200">
                    {assessment.company_name || "Verified Enterprise"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Assessment Period
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-200">
                    {assessment.period || "Current Quarter"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Target size={16} className="text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Outcome Status
                  </p>
                  <p className={cn("text-sm font-black uppercase tracking-tight", statusColor)}>
                    {primary.risk_label}
                  </p>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                    via {primaryModelName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BrainCircuit size={16} className="text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Model Confidence
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-200">
                    {(primary.distress_probability * 100).toFixed(1)}% Distress Prob.
                  </p>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                    via {primaryModelName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Disagreement banner — directly below metadata, before Section 1 */}
        {assessment.models_agree === false && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
              Our two models disagree on this result, which can happen when a
              business has an unusual mix of financial indicators. Review both
              results, and consider this a signal to look more closely rather
              than a final answer.
            </p>
          </div>
        )}

        {/* Section 1: Executive Summary (AI Narrative) */}
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <BrainCircuit size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              1. Executive Summary (AI Narrative)
            </h3>
          </div>

          <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden group">
            <div
              className={cn(
                "absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2",
                statusBg
              )}
            />
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-zinc-400 leading-relaxed text-[13px] italic">
              <FormattedMessage
                content={
                  primary.narrative?.content ||
                  "Assessment narrative is being generated based on latest financial indicators..."
                }
              />
            </div>
          </div>
        </div>

        {/* Section 2: Financial Ratio Analysis */}
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Search size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              2. Financial Ratio Analysis
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ratios)
              .slice(0, 4)
              .map(([key, val]: any) => (
                <div
                  key={key}
                  className="p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-white/5 space-y-2 group hover:border-blue-200 dark:hover:border-blue-900/30 transition-all"
                >
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                    {key.replace(/_/g, " ")}
                  </p>
                  <div className="flex items-end justify-between">
                    <span className="text-xl font-black text-gray-900 dark:text-zinc-100 tabular-nums">
                      {typeof val === "number" ? val.toFixed(2) : val}
                    </span>
                    <TrendingUp size={14} className="text-gray-300" />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Section 3: Explainable AI (SHAP) Insights */}
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <ShieldCheck size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              3. Explainable AI (SHAP) Insights
            </h3>
          </div>

          <div className="space-y-3">
            {Object.entries(shapValues)
              .sort((a: any, b: any) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 3)
              .map(([feat, score]: any) => (
                <div
                  key={feat}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-800/10"
                >
                  <div className="flex items-center gap-3">
                    <ArrowRight
                      size={12}
                      className={cn(score > 0 ? "text-red-500" : "text-emerald-500")}
                    />
                    <span className="text-[11px] font-bold text-gray-700 dark:text-zinc-300 capitalize">
                      {feat.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                      score > 0
                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                    )}
                  >
                    {score > 0 ? "Increases Risk" : "Supports Health"}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Section 4: Logistic Regression Comparison (collapsible) */}
        {secondary ? (
          <div className="border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLR((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 bg-purple-50/70 dark:bg-purple-950/20 hover:bg-purple-100/60 dark:hover:bg-purple-950/30 transition-colors"
            >
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
                4. Compare with Logistic Regression
              </span>
              {showLR ? (
                <ChevronUp size={16} className="text-gray-400 dark:text-zinc-500" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 dark:text-zinc-500" />
              )}
            </button>

            {showLR && (
              <div className="px-5 pb-5 pt-3 bg-white dark:bg-zinc-900 border-t border-gray-50 dark:border-zinc-800 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Secondary model headline */}
                <div className="flex items-center gap-2 pb-1">
                  {secondary.risk_label === "Healthy" ? (
                    <ShieldCheck size={15} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={15} className="text-red-500" />
                  )}
                  <p
                    className={cn(
                      "text-sm font-bold",
                      secondary.risk_label === "Healthy"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {secondary.risk_label}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    · {Math.round(secondary.distress_probability * 100)}% distress probability
                  </span>
                </div>

                {/* Secondary narrative */}
                {secondary.narrative && (
                  <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                      AI Financial Narrative
                    </p>
                    <div className="prose prose-xs dark:prose-invert max-w-none text-gray-600 dark:text-zinc-400 leading-relaxed text-[12px] italic">
                      <FormattedMessage content={secondary.narrative.content} />
                    </div>
                  </div>
                )}

                {/* Secondary SHAP */}
                {secondary.shap_values &&
                  Object.keys(secondary.shap_values).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        SHAP Insights
                      </p>
                      {Object.entries(secondary.shap_values)
                        .sort((a: any, b: any) => Math.abs(b[1]) - Math.abs(a[1]))
                        .slice(0, 3)
                        .map(([feat, score]: any) => (
                          <div
                            key={feat}
                            className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-800/10"
                          >
                            <div className="flex items-center gap-3">
                              <ArrowRight
                                size={12}
                                className={cn(
                                  score > 0 ? "text-red-500" : "text-emerald-500"
                                )}
                              />
                              <span className="text-[11px] font-bold text-gray-700 dark:text-zinc-300 capitalize">
                                {feat.replace(/_/g, " ")}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                                score > 0
                                  ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                              )}
                            >
                              {score > 0 ? "Increases Risk" : "Supports Health"}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        ) : lrMissing ? (
          /* Section 4 placeholder — LR did not complete, RF is the only model */
          <div className="border border-gray-100 dark:border-zinc-800 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-zinc-300 uppercase tracking-wide">
                  4. Logistic Regression Comparison Unavailable
                </p>
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed mt-1">
                  The Logistic Regression model did not complete for this assessment.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="pt-16 border-t border-gray-100 dark:border-zinc-800 flex flex-col items-center space-y-4">
          <div className="flex items-center gap-2 opacity-50 grayscale select-none">
            <div className="w-16 h-16 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
              <ShieldCheck size={32} className="text-gray-400" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-[9px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-[0.3em]">
              FinWatch Zambia Official Record
            </p>
            <p className="text-[8px] text-gray-400 italic">
              This report is for internal business health monitoring and academic purposes only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
