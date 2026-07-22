"use client";

/**
 * FinWatch Zambia - Institutional Model Analytics Page Component
 *
 * Three-tier model evaluation: offline test-set metrics (Tier 1),
 * live model agreement / disagreement rate (Tier 2), and aggregate
 * RF vs LR comparison. Domain-shift context surfaced throughout.
 */

import { useEffect, useState } from "react";
import {
  Cpu,
  Info,
  Loader2,
  AlertTriangle,
  Percent,
  Activity,
  BarChart3,
} from "lucide-react";
import api from "@/lib/api";
import {
  getInstitutionalAuthHeader,
  getInstitutionalUser,
  InstitutionalUserResponse,
} from "@/lib/institutional-auth";
import { useInstitutionalFilter } from "@/context/InstitutionalFilterContext";
import { cn } from "@/lib/utils";
import { InstitutionalFilterBar } from "@/components/institutional/InstitutionalFilterBar";

interface ModelMetricsDetail {
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  distressed_recall: number | null;
  distressed_precision: number | null;
}

interface ModelIntegrityResponse {
  random_forest: ModelMetricsDetail;
  logistic_regression: ModelMetricsDetail;
  note: string;
}

interface ModelAgreementResponse {
  paired_assessment_count: number;
  disagreement_count: number;
  disagreement_rate: number;
  agreement_rate: number;
}

interface ModelPerfItem {
  model_name: string;
  total_predictions: number;
  distress_count: number;
  healthy_count: number;
  avg_distress_prob: number;
  distress_rate: number;
}

function fmtPct(v: number | null | undefined): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : "N/A";
}

export default function InstitutionalModelAnalyticsPage() {
  const { selectedScales, selectedSectors } = useInstitutionalFilter();

  const [integrity, setIntegrity] = useState<ModelIntegrityResponse | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(true);

  const [agreement, setAgreement] = useState<ModelAgreementResponse | null>(null);
  const [modelPerf, setModelPerf] = useState<ModelPerfItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("regulator");

  // Tier 1 — fetched once, not scale/sector filterable
  useEffect(() => {
    const user = getInstitutionalUser<InstitutionalUserResponse>();
    if (user) setUserRole(user.role);

    api
      .get<ModelIntegrityResponse>("/api/institutional/model-integrity", {
        headers: getInstitutionalAuthHeader(),
      })
      .then((res) => setIntegrity(res.data))
      .catch(() => setError("Failed to load offline evaluation metrics."))
      .finally(() => setIntegrityLoading(false));
  }, []);

  // Tier 2 + Aggregate comparison — filterable by scale/sector
  useEffect(() => {
    setLiveLoading(true);
    const headers = getInstitutionalAuthHeader();
    const params = {
      scale: selectedScales.join(","),
      sector: selectedSectors.join(","),
    };

    Promise.all([
      api.get<ModelAgreementResponse>("/api/institutional/model-agreement", {
        headers,
        params,
      }),
      api.get<ModelPerfItem[]>("/api/institutional/model-performance", {
        headers,
        params,
      }),
    ])
      .then(([agreementRes, perfRes]) => {
        setAgreement(agreementRes.data);
        setModelPerf(perfRes.data);
      })
      .catch(() => setError("Failed to load live model performance data."))
      .finally(() => setLiveLoading(false));
  }, [selectedScales, selectedSectors]);

  const isAnalyst = userRole === "policy_analyst";
  const accentColor = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";
  const accentBg = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";
  const loaderColor = isAnalyst ? "text-blue-600" : "text-emerald-500";

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
      </div>
    );

  const models: { key: "random_forest" | "logistic_regression"; label: string }[] = [
    { key: "random_forest", label: "Random Forest" },
    { key: "logistic_regression", label: "Logistic Regression" },
  ];

  return (
    <div className="p-6 pb-20 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            accentBg
          )}
        >
          <Cpu size={20} className={accentColor} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
            Model Analytics
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 leading-none">
            Offline evaluation, live model agreement, and aggregate RF vs LR comparison
          </p>
        </div>
      </div>

      {/* Domain-shift context */}
      <div className="flex items-start gap-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl px-5 py-4">
        <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 leading-relaxed font-medium">
          Predictive models are trained and evaluated on the UCI Polish Companies Bankruptcy dataset — no labelled Zambian distress data currently exists. Model outputs are an early-warning research signal, not a validated measure of Zambian SME performance.
        </p>
      </div>

      {/* Tier 1 — Offline Evaluation */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-widest">
            Offline Evaluation
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            Fixed test-set results (Polish dataset) — not filterable by scale or sector
          </p>
        </div>

        {integrityLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map(({ key, label }) => {
              const stats = integrity?.[key];
              return (
                <div
                  key={key}
                  className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none"
                >
                  <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 mb-3">
                    {label}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-lg font-black text-emerald-500">
                        {fmtPct(stats?.accuracy)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-tighter">
                        Accuracy
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-blue-500">
                        {fmtPct(stats?.recall)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-tighter">
                        Recall (Macro)
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-amber-500">
                        {fmtPct(stats?.distressed_recall)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-tighter">
                        Recall (Distressed)
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-red-500">
                        {fmtPct(stats?.distressed_precision)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-tighter">
                        Precision (Distressed)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {integrity?.note && (
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 italic leading-relaxed">
            {integrity.note}
          </p>
        )}
      </div>

      <InstitutionalFilterBar />

      {/* Tier 2 — Live Model Agreement */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-widest">
            Live Model Agreement
          </h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            Categorical disagreement rate across paired live assessments — an operational
            signal, not an accuracy proxy, since no Zambian ground truth exists to measure
            live accuracy directly
          </p>
        </div>

        {liveLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center mb-3",
                  accentBg
                )}
              >
                <Activity size={16} className={accentColor} />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {agreement?.paired_assessment_count ?? "—"}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Paired Assessments
              </p>
            </div>
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {agreement?.disagreement_count ?? "—"}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Disagreements</p>
            </div>
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
                <Percent size={16} className="text-red-500" />
              </div>
              <p className="text-xl font-bold text-red-500">
                {fmtPct(agreement?.disagreement_rate)}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Disagreement Rate
              </p>
            </div>
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
              <div className="w-8 h-8 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3">
                <Percent size={16} className="text-green-500" />
              </div>
              <p className="text-xl font-bold text-green-500">
                {fmtPct(agreement?.agreement_rate)}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Agreement Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Model Comparison */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        <div className="px-6 py-4 border-b border-gray-100/50 dark:border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-wider">
              Aggregate Model Comparison
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
              Live prediction counts and distress rates per model
            </p>
          </div>
          <BarChart3 size={14} className="text-gray-400" />
        </div>

        {liveLoading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={24} className={cn("animate-spin", loaderColor)} />
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
                  <tr>
                    {[
                      "Model",
                      "Total Predictions",
                      "Distress Rate",
                      "Avg Distress Prob.",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left font-bold text-gray-400 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {modelPerf.map((m) => (
                    <tr key={m.model_name}>
                      <td className="px-5 py-3 font-semibold text-gray-700 dark:text-zinc-200 capitalize">
                        {m.model_name.replace("_", " ")}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {m.total_predictions}
                      </td>
                      <td className="px-5 py-3 font-bold text-red-500">
                        {fmtPct(m.distress_rate)}
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-500">
                        {fmtPct(m.avg_distress_prob)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3 p-4">
              {modelPerf.map((m) => (
                <div
                  key={m.model_name}
                  className="rounded-xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 shadow-sm dark:shadow-none text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-gray-800 dark:text-zinc-100 text-xs tracking-tight capitalize">
                      {m.model_name.replace("_", " ")}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                      {fmtPct(m.distress_rate)} Distress
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 text-[9px]">
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Total Predictions
                      </p>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                        {m.total_predictions}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Avg Distress Prob.
                      </p>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300 mt-0.5">
                        {fmtPct(m.avg_distress_prob)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
