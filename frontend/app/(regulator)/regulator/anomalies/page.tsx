"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Loader2, Lock } from "lucide-react";
import api from "@/lib/api";
import { getRegAuthHeader, getRegUser } from "@/lib/regulator-auth";

interface AnomalyItem {
  assessment_id: number;
  industry: string;
  model_used: string;
  distress_probability: number;
  risk_label: string;
  period: string;
  flagged_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullReg, setIsFullReg] = useState(false);

  useEffect(() => {
    const user = getRegUser<{ role: string }>();
    const full = user?.role === "regulator";
    setIsFullReg(full);

    if (!full) {
      setLoading(false);
      return;
    }

    api
      .get("/api/regulator/anomalies", { headers: getRegAuthHeader() })
      .then((r) => setAnomalies(r.data))
      .catch((err) => {
        if (err?.response?.status === 403) {
          setIsFullReg(false);
        } else {
          setError("Failed to load anomaly data.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (!isFullReg) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex flex-col items-center gap-5 py-24">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <Lock size={28} className="text-amber-500" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-bold text-gray-800 dark:text-zinc-100 mb-2">
            Full Regulator Access Required
          </h2>
          <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-sm">
            The anomaly flags page is restricted to users with the{" "}
            <strong>Regulator</strong> role. Policy Analysts have read-only
            access to aggregate insights and trends, but not to individual
            high-risk assessment flags.
          </p>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertTriangle size={28} className="text-red-400" />
        <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
      </div>
    );

  return (
    <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
            Anomaly Flags
          </h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
            Regulator Only
          </span>
        </div>
        <p className="text-sm text-gray-400 dark:text-zinc-500">
          Anonymised high-risk assessments (distress probability ≥ 70%). No
          company names or owner identifiers are included.
        </p>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <ShieldCheck
          size={15}
          className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
        />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          All data on this page is anonymised. Assessment IDs are internal
          reference numbers only and cannot be used to identify individual
          companies or their owners.
        </p>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <ShieldCheck size={24} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
              No high-risk flags
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              No assessments currently exceed the 70% distress threshold.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                High-Risk Assessments
              </h2>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                {anomalies.length} flags · sorted by probability descending
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                  {[
                    "Ref. ID",
                    "Sector",
                    "Period",
                    "Model",
                    "Distress Prob.",
                    "Risk Label",
                    "Flagged At",
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
                {anomalies.map((a) => (
                  <tr
                    key={a.assessment_id}
                    className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-zinc-400">
                      #{a.assessment_id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-zinc-100">
                      {a.industry}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600 dark:text-zinc-400">
                      {a.period}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                        {a.model_used === "random_forest" ? "RF" : "LR"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{
                              width: `${a.distress_probability * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {(a.distress_probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                        <AlertTriangle size={9} /> {a.risk_label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-zinc-500 font-mono">
                      {formatDate(a.flagged_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
