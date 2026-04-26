"use client";

/**
 * FinWatch Zambia - Regulator Reports & Exports
 *
 * Model performance summaries and data export for regulatory reporting.
 * Exports are restricted to users with the Regulator role.
 */

import { useState, useEffect } from "react";
import {
  FileBarChart,
  Download,
  Loader2,
  AlertTriangle,
  Info,
  BarChart3,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";
import { getRegAuthHeader, getRegUser } from "@/lib/regulator-auth";
import { RegulatorExportModal } from "@/components/regulator/reports/RegulatorExportModal";

interface ModelPerfItem {
  model_name: string;
  total_predictions: number;
  distress_count: number;
  healthy_count: number;
  avg_distress_prob: number;
  distress_rate: number;
}

export default function RegulatorReportsPage() {
  const [modelPerf, setModelPerf] = useState<ModelPerfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullReg, setIsFullReg] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const user = getRegUser<{ role: string }>();
    setIsFullReg(user?.role === "regulator");

    api
      .get("/api/regulator/model-performance", { headers: getRegAuthHeader() })
      .then((r) => setModelPerf(r.data))
      .catch(() => setError("Failed to load model performance data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="p-6 pb-20 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              Reports & Exports
            </h1>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
              Model performance summaries and data export for regulatory
              reporting.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export Data</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
          <Info
            size={14}
            className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
          />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Anonymised Export
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/70">
              All exported data is aggregate-level only. No company names, user
              IDs, or personally identifiable information is included. Exports
              are available in PDF, CSV, JSON, or as a bundled ZIP archive.
            </p>
          </div>
        </div>

        {/* Policy analyst warning */}
        {!isFullReg && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <ShieldCheck
              size={14}
              className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
            />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Data export is restricted to users with the full{" "}
              <strong>Regulator</strong> role. Policy Analysts can view reports
              but cannot export data.
            </p>
          </div>
        )}

        {/* Model performance table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle size={24} className="text-red-300" />
            <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                  ML Model Performance Summary
                </h2>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  Aggregate usage and outcome statistics for each deployed model
                </p>
              </div>

              {modelPerf.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14">
                  <BarChart3
                    size={24}
                    className="text-gray-200 dark:text-zinc-700"
                  />
                  <p className="text-sm text-gray-400 dark:text-zinc-500">
                    No model data yet
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                        {[
                          "Model",
                          "Total Predictions",
                          "Distressed",
                          "Healthy",
                          "Avg Distress Prob.",
                          "Distress Rate",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                      {modelPerf.map((m) => (
                        <tr
                          key={m.model_name}
                          className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <TrendingUp
                                size={14}
                                className="text-purple-500"
                              />
                              <span className="font-semibold text-gray-800 dark:text-zinc-100">
                                {m.model_name === "random_forest"
                                  ? "Random Forest"
                                  : "Logistic Regression"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 tabular-nums text-gray-700 dark:text-zinc-200">
                            {m.total_predictions}
                          </td>
                          <td className="px-5 py-4 tabular-nums font-semibold text-red-600 dark:text-red-400">
                            {m.distress_count}
                          </td>
                          <td className="px-5 py-4 tabular-nums font-semibold text-green-600 dark:text-green-400">
                            {m.healthy_count}
                          </td>
                          <td className="px-5 py-4 tabular-nums font-mono text-xs text-gray-600 dark:text-zinc-300">
                            {(m.avg_distress_prob * 100).toFixed(2)}%
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${m.distress_rate >= 0.7 ? "bg-red-500" : m.distress_rate >= 0.4 ? "bg-amber-400" : "bg-green-500"}`}
                                  style={{ width: `${m.distress_rate * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200 tabular-nums">
                                {(m.distress_rate * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Academic context */}
            <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileBarChart
                  size={14}
                  className="text-purple-600 dark:text-purple-400"
                />
                <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">
                  Academic Context
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                FinWatch uses two complementary ML models:{" "}
                <strong>Random Forest</strong> (Barboza et al., 2017) for its
                superior classification performance on imbalanced financial
                datasets, and <strong>Logistic Regression</strong> for
                interpretability and baseline comparison. Both models are
                trained on the UCI Polish Companies Bankruptcy dataset
                (doi:10.24432/C5V61K) and contextualised against World Bank
                Zambia Enterprise Survey data (2019–2020). SHAP attributions
                provide ratio-level explainability per prediction.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Export Modal */}
      <RegulatorExportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isFullRegulator={isFullReg}
      />
    </>
  );
}
