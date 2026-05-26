"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";

interface PredictionReportPreviewProps {
  prediction: any;
}

/**
 * PredictionReportPreview
 *
 * A high-fidelity, interactive preview of an individual SME health assessment.
 * Mirrors the professional PDF layout with SME-specific branding.
 */
export function PredictionReportPreview({
  prediction,
}: PredictionReportPreviewProps) {
  if (!prediction) return null;

  const isHealthy = prediction.risk_label === "Healthy";
  const statusColor = isHealthy ? "text-emerald-500" : "text-red-500";
  const statusBg = isHealthy ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[850px]">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <FileText
              size={20}
              className="text-purple-600 dark:text-purple-400"
            />
          </div>
          <div>
            <p className="text-[10px] font-black text-purple-600/60 dark:text-purple-400/60 uppercase tracking-widest leading-none">
              Assessment Preview
            </p>
            <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-tight mt-1">
              Assessment #{prediction.id?.toString().slice(-6).toUpperCase()}
            </h2>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isHealthy ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            )}
          />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            {prediction.risk_label} Result
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
        {/* Title & Metadata */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight leading-tight">
              Financial Health & Distress <br />
              <span className="text-purple-600 dark:text-purple-400 italic">
                Assessment Report
              </span>
            </h1>
            <div className="h-1.5 w-24 bg-purple-600 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Building size={16} className="text-gray-400" />
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    SME Entity
                  </p>
                  <p className="text-sm font-bold text-gray-700 dark:text-zinc-200">
                    {prediction.company_name || "Verified Enterprise"}
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
                    {prediction.period || "Current Quarter"}
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
                  <p
                    className={cn(
                      "text-sm font-black uppercase tracking-tight",
                      statusColor
                    )}
                  >
                    {prediction.risk_label}
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
                    {(prediction.distress_probability * 100).toFixed(1)}%
                    Distress Prob.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: AI Summary */}
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <BrainCircuit
                size={16}
                className="text-purple-600 dark:text-purple-400"
              />
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
                  prediction.narrative?.content ||
                  "Assessment narrative is being generated based on latest financial indicators..."
                }
              />
            </div>
          </div>
        </div>

        {/* Section 2: Ratio Deep Dive */}
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
            {Object.entries(prediction.ratios || {})
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

        {/* Section 3: Explainability (SHAP) */}
        <div className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <ShieldCheck
                size={16}
                className="text-orange-600 dark:text-orange-400"
              />
            </div>
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              3. Explainable AI (SHAP) Insights
            </h3>
          </div>

          <div className="space-y-3">
            {Object.entries(prediction.shap_values || {})
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
        </div>

        {/* Footer simulation */}
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
              This report is for internal business health monitoring and
              academic purposes only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
