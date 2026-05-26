"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  TrendingUp,
  AlertCircle,
  ShieldCheck,
  PieChart,
  BarChart3,
  BrainCircuit,
  Lock,
  Eye,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/shared/FormattedMessage";

interface InstitutionalReportPreviewProps {
  data: any;
  role: string;
  config: {
    includeAiSummary: boolean;
    maskEntities: boolean;
    includeModelAudit: boolean;
    includeRiskMatrix: boolean;
  };
}

/**
 * InstitutionalReportPreview
 *
 * A high-fidelity, glassmorphic preview of the institutional report.
 * Mirrors the structure of the professional PDF export.
 */
export function InstitutionalReportPreview({
  data,
  role,
  config,
}: InstitutionalReportPreviewProps) {
  if (!data) return null;

  const isAnalyst = role === "policy_analyst";
  const accentColor = isAnalyst ? "text-blue-500" : "text-emerald-500";
  const accentBg = isAnalyst ? "bg-blue-500" : "bg-emerald-500";
  const accentBorder = isAnalyst
    ? "border-blue-500/20"
    : "border-emerald-500/20";

  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none overflow-hidden flex flex-col h-full max-h-[800px]">
      {/* Document Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className={accentColor} />
          <span className="text-sm font-bold text-gray-700 dark:text-zinc-200 uppercase tracking-tight">
            Report Preview
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800">
            <Eye size={12} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-500 uppercase">
              Live Preview
            </span>
          </div>
          {config.maskEntities && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
              <Lock size={12} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase">
                Anonymized
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Document Body */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        {/* Title Page Simulation */}
        <div className="space-y-4 border-b border-gray-100 dark:border-zinc-800 pb-6">
          <div
            className={cn("w-12 h-1 bg-current rounded-full mb-2", accentColor)}
          />
          <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">
            {isAnalyst
              ? "Strategic Policy Insight Report"
              : "System-Wide Aggregate Performance Report"}
          </h1>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                Scope
              </p>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                All Registered Zambian SME Sectors
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                Data Coverage
              </p>
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                {data.overview?.total_assessments || 0} Individual Assessments
              </p>
            </div>
          </div>
        </div>

        {/* Section: AI Executive Summary */}
        {config.includeAiSummary && data.ai_summary && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className={accentColor} />
              <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
                1. Executive Summary (AI Synthesized)
              </h3>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 relative overflow-hidden">
              <div
                className={cn("absolute top-0 left-0 w-1 h-full", accentBg)}
              />
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-zinc-400 leading-relaxed italic">
                <FormattedMessage content={data.ai_summary} />
              </div>
            </div>
          </div>
        )}

        {/* Section: Aggregated SHAP */}
        <div className="space-y-4 animate-in fade-in duration-700">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className={accentColor} />
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              Aggregated Feature Importance (SHAP)
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            The following ratios are the most significant drivers of financial
            health predictions across the system.
          </p>

          <div className="border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden bg-white/50 dark:bg-white/5">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Financial Ratio
                  </th>
                  <th className="px-4 py-2 text-center font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Avg Influence
                  </th>
                  <th className="px-4 py-2 text-right font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Impact Direction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {Object.entries(data.aggregated_shap || {})
                  .sort((a: any, b: any) => Math.abs(b[1]) - Math.abs(a[1]))
                  .slice(0, 5)
                  .map(([feat, val]: any) => (
                    <tr
                      key={feat}
                      className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-zinc-200 capitalize">
                        {feat.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-500 dark:text-zinc-400">
                        {val > 0 ? "+" : ""}
                        {val.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                            val > 0
                              ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                              : "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                          )}
                        >
                          {val > 0 ? "Increases Risk" : "Supports Health"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section: Risk Matrix */}
        {config.includeRiskMatrix && (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="flex items-center gap-2">
              <PieChart size={16} className={accentColor} />
              <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
                Systemic Risk Matrix
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {["small_scale", "medium_scale"].map((scale) => {
                const h = data.risk_matrix?.[scale]?.Healthy || 0;
                const d = data.risk_matrix?.[scale]?.Distressed || 0;
                const total = h + d;
                const dRate = total > 0 ? (d / total) * 100 : 0;

                return (
                  <div
                    key={scale}
                    className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/20 space-y-3"
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {scale.replace("_", " ")}
                    </p>
                    <div className="flex items-end justify-between">
                      <span className="text-xl font-black text-gray-900 dark:text-zinc-100">
                        {dRate.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">
                        Distress Rate
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${dRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-medium text-gray-400">
                      <span>Healthy: {h}</span>
                      <span>Distressed: {d}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Model Audit */}
        {config.includeModelAudit && (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={accentColor} />
              <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
                Model Integrity & Transparency
              </h3>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 bg-gray-50/30 dark:bg-zinc-800/10 space-y-4">
              {Object.entries(data.model_integrity || {}).map(
                ([model, stats]: any) => (
                  <div
                    key={model}
                    className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 capitalize">
                        {model.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Validated Dataset Outcome
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {(stats.accuracy * 100).toFixed(1)}%
                        </p>
                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">
                          Accuracy
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {(stats.precision * 100).toFixed(1)}%
                        </p>
                        <p className="text-[8px] text-gray-400 uppercase tracking-tighter">
                          Precision
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Section: Anomaly Table (Preview) */}
        <div className="space-y-4 opacity-50 select-none grayscale">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <h3 className="text-xs font-black text-gray-800 dark:text-zinc-200 uppercase tracking-widest">
              Systemic Anomaly Flags
            </h3>
          </div>
          <div className="text-center py-8 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-2xl">
            <Info size={20} className="mx-auto text-gray-300 mb-2" />
            <p className="text-[10px] text-gray-400 font-medium">
              Detailed data tables omitted from preview to optimize performance.
            </p>
          </div>
        </div>

        {/* Confidentiality Footer */}
        <div className="pt-12 text-center space-y-2 border-t border-gray-100 dark:border-zinc-800">
          <p className="text-[9px] font-black text-gray-400 dark:text-zinc-600 uppercase tracking-[0.2em]">
            Institutional Oversight Protocol
          </p>
          <p className="text-[8px] text-gray-400 italic">
            This report contains anonymised aggregate data for academic research
            and authorised institutional oversight only.
          </p>
        </div>
      </div>
    </div>
  );
}
