"use client";

/**
 * FinWatch Zambia - Institutional Reports & Exports Page Component
 *
 * Model performance summaries and data export for institutional reporting.
 * Exports are restricted to users with the Regulator role.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Download,
  Loader2,
  AlertTriangle,
  Info,
  TrendingUp,
  Settings2,
  Sparkles,
  ShieldAlert,
  Fingerprint,
  Eye,
  RotateCw,
  RefreshCw,
  Building2,
} from "lucide-react";
import api from "@/lib/api";
import {
  getInstitutionalAuthHeader,
  getInstitutionalUser,
  InstitutionalUserResponse,
} from "@/lib/institutional-auth";
import { cn } from "@/lib/utils";
import { InstitutionalFilterBar } from "@/components/institutional/InstitutionalFilterBar";
import { InstitutionalExportModal } from "@/components/institutional/reports/InstitutionalExportModal";
import { InstitutionalReportPreview } from "@/components/institutional/reports/InstitutionalReportPreview";
import { Switch } from "@/components/ui/switch";

import { useInstitutionalFilter } from "@/context/InstitutionalFilterContext";

interface ModelPerfItem {
  model_name: string;
  total_predictions: number;
  distress_count: number;
  healthy_count: number;
  avg_distress_prob: number;
  distress_rate: number;
}

interface ScaleItem {
  scale: string;
  total_assessments: number;
  distress_count: number;
  healthy_count: number;
  avg_distress_prob: number;
  distress_rate: number;
}

export default function InstitutionalReportsPage() {
  const { selectedScales, selectedSectors, isFilterLoading } = useInstitutionalFilter();
  const [modelPerf, setModelPerf] = useState<ModelPerfItem[]>([]);
  const [scales, setScales] = useState<ScaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFullReg, setIsFullReg] = useState(false);
  const [isAnalyst, setIsAnalyst] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("regulator");

  const didInitialLoad = useRef(false);

  // Config State
  const [config, setConfig] = useState({
    includeAiSummary: true,
    maskEntities: false,
    includeModelAudit: true,
    includeRiskMatrix: true,
  });

  const fetchStaticData = useCallback(async () => {
    setLoading(true);
    setError("");
    const headers = getInstitutionalAuthHeader();
    const params = {
      scale: selectedScales.join(","),
      sector: selectedSectors.join(","),
    };
    try {
      const [modRes, scaleRes] = await Promise.all([
        api.get("/api/institutional/model-performance", { headers, params }),
        api.get("/api/institutional/scales", { headers, params }),
      ]);
      setModelPerf(modRes.data);
      setScales(scaleRes.data);

      const user = getInstitutionalUser<InstitutionalUserResponse>();
      const resolvedRole = user?.role === "policy_analyst" ? "analyst" : "regulator";
      sessionStorage.setItem(
        `inst_reports_data_${resolvedRole}`,
        JSON.stringify({ modelPerf: modRes.data, scales: scaleRes.data })
      );
      sessionStorage.setItem(`inst_reports_loaded_${resolvedRole}`, "true");
    } catch (err) {
      setError("Failed to load institutional reporting data.");
    } finally {
      setLoading(false);
    }
  }, [selectedScales, selectedSectors]);

  const fetchPreview = useCallback(async (forceAi: boolean = true) => {
    setPreviewLoading(true);
    const params = {
      include_ai_summary: forceAi,
      scale: selectedScales.join(","),
      sector: selectedSectors.join(","),
    };
    try {
      const res = await api.get("/api/institutional/reports/preview", {
        headers: getInstitutionalAuthHeader(),
        params,
      });
      setPreviewData(res.data);

      const user = getInstitutionalUser<InstitutionalUserResponse>();
      const resolvedRole = user?.role === "policy_analyst" ? "analyst" : "regulator";
      sessionStorage.setItem(`inst_reports_preview_${resolvedRole}`, JSON.stringify(res.data));
    } catch (err) {
      console.error("Preview fetch failed", err);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedScales, selectedSectors]);

  useEffect(() => {
    const user = getInstitutionalUser<InstitutionalUserResponse>();
    const resolvedRole = user?.role || "regulator";
    setUserRole(resolvedRole);
    setIsFullReg(resolvedRole === "regulator");
    setIsAnalyst(resolvedRole === "policy_analyst");

    const roleKey = resolvedRole === "policy_analyst" ? "analyst" : "regulator";

    // Restore Config
    const savedConfig = sessionStorage.getItem(`inst_reports_config_${roleKey}`);
    let initialConfig = {
      includeAiSummary: true,
      maskEntities: resolvedRole === "policy_analyst",
      includeModelAudit: true,
      includeRiskMatrix: true,
    };
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        initialConfig = {
          ...initialConfig,
          ...parsed,
          maskEntities: resolvedRole === "policy_analyst" ? true : !!parsed.maskEntities,
        };
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    setConfig(initialConfig);

    // Restore cached report data
    const cacheLoaded = sessionStorage.getItem(`inst_reports_loaded_${roleKey}`);
    const cacheData = sessionStorage.getItem(`inst_reports_data_${roleKey}`);

    if (cacheLoaded === "true" && cacheData) {
      try {
        const parsedData = JSON.parse(cacheData);
        setModelPerf(parsedData.modelPerf || []);
        setScales(parsedData.scales || []);

        const cachePreview = sessionStorage.getItem(`inst_reports_preview_${roleKey}`);
        if (cachePreview) {
          setPreviewData(JSON.parse(cachePreview));
        }
        setLoading(false);
        didInitialLoad.current = true;
      } catch (e) {
        console.error("Failed to restore reports session state", e);
      }
    }
  }, []);

  // Debounced config persistence (300ms)
  useEffect(() => {
    if (typeof window === "undefined" || !userRole) return;
    const roleKey = userRole === "policy_analyst" ? "analyst" : "regulator";
    const key = `inst_reports_config_${roleKey}`;

    const timer = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(config));
    }, 300);

    return () => clearTimeout(timer);
  }, [config, userRole]);

  // Once-per-session data load guard with filter change triggers
  useEffect(() => {
    if (isFilterLoading) return;

    if (didInitialLoad.current) {
      didInitialLoad.current = false;
      return;
    }

    fetchStaticData();
    fetchPreview(config.includeAiSummary);
  }, [fetchStaticData, fetchPreview, isFilterLoading, config.includeAiSummary]);

  const handleReload = async () => {
    const roleKey = userRole === "policy_analyst" ? "analyst" : "regulator";
    
    // Clear session cache keys (except config)
    sessionStorage.removeItem(`inst_reports_loaded_${roleKey}`);
    sessionStorage.removeItem(`inst_reports_data_${roleKey}`);
    sessionStorage.removeItem(`inst_reports_preview_${roleKey}`);

    setLoading(true);
    setPreviewLoading(true);
    setError("");

    const headers = getInstitutionalAuthHeader();
    const params = {
      scale: selectedScales.join(","),
      sector: selectedSectors.join(","),
    };

    try {
      const [modRes, scaleRes] = await Promise.all([
        api.get("/api/institutional/model-performance", { headers, params }),
        api.get("/api/institutional/scales", { headers, params }),
      ]);
      
      setModelPerf(modRes.data);
      setScales(scaleRes.data);
      
      sessionStorage.setItem(
        `inst_reports_data_${roleKey}`,
        JSON.stringify({ modelPerf: modRes.data, scales: scaleRes.data })
      );

      const previewParams = {
        include_ai_summary: config.includeAiSummary,
        scale: selectedScales.join(","),
        sector: selectedSectors.join(","),
      };
      
      const previewRes = await api.get("/api/institutional/reports/preview", {
        headers,
        params: previewParams,
      });
      setPreviewData(previewRes.data);

      sessionStorage.setItem(`inst_reports_preview_${roleKey}`, JSON.stringify(previewRes.data));
      sessionStorage.setItem(`inst_reports_loaded_${roleKey}`, "true");
    } catch (err) {
      setError("Failed to reload institutional reporting data.");
    } finally {
      setLoading(false);
      setPreviewLoading(false);
    }
  };

  const accentGradient = isAnalyst
    ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
    : "linear-gradient(135deg, #059669, #047857)";

  const accentColor = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";
  const accentBg = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";

  return (
    <>
      <div className="px-6 pb-20 max-w-[1600px] mx-auto">
        {/* SME-Aligned Sticky Header */}
        <div className="sticky top-0 z-20 -mx-6 px-6 py-6 mb-6 bg-white/70 dark:bg-white/5 backdrop-blur-xl border-b border-white/20 dark:border-white/10 transition-all duration-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                  accentBg
                )}
              >
                <FileText
                  size={20}
                  className={isAnalyst ? "text-blue-600" : "text-purple-600"}
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                  Reports
                </h1>
                <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5 leading-none">
                  {isAnalyst
                    ? "Analyse aggregate sector trends and professional policy insights"
                    : "Access and manage comprehensive institutional health assessments"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReload}
                disabled={loading || previewLoading}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-40 shadow-sm"
              >
                {loading || previewLoading ? (
                  <Loader2 size={15} className="animate-spin text-gray-500" />
                ) : (
                  <RotateCw size={15} className="text-gray-500" />
                )}
                <span>Reload Report</span>
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-sm flex-shrink-0"
                style={{ background: accentGradient }}
              >
                <Download size={15} />
                <span className="hidden sm:inline">Export Report</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <InstitutionalFilterBar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Configuration & Stats */}
          <div className="lg:col-span-5 space-y-8">
            {/* Configuration Card */}
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                <Settings2 size={18} className="text-gray-400" />
                <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-widest">
                  Report Configuration
                </h2>
              </div>

              <div className="space-y-4">
                {/* AI Summary Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-white/5 transition-all hover:border-purple-200 dark:hover:border-purple-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <Sparkles
                        size={16}
                        className="text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-zinc-200">
                        AI Institutional Synthesis
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Generate professional narrative summaries
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {previewLoading && config.includeAiSummary && (
                      <Loader2
                        size={12}
                        className="animate-spin text-purple-500"
                      />
                    )}
                    <Switch
                      checked={config.includeAiSummary}
                      onCheckedChange={(v) =>
                        setConfig((prev) => ({ ...prev, includeAiSummary: v }))
                      }
                    />
                  </div>
                </div>

                {/* Anonymization Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-white/5 transition-all hover:border-amber-200 dark:hover:border-amber-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Fingerprint
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-zinc-200">
                        Entity Masking
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Anonymize SME names (Auto for Analysts)
                      </p>
                    </div>
                  </div>
                  <Switch
                    disabled={isAnalyst}
                    checked={config.maskEntities}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, maskEntities: v }))
                    }
                  />
                </div>

                {/* Model Audit Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/30 border border-gray-100 dark:border-white/5 transition-all hover:border-emerald-200 dark:hover:border-emerald-900/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <ShieldAlert
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-zinc-200">
                        Model Integrity Audit
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Include technical performance metrics
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={config.includeModelAudit}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, includeModelAudit: v }))
                    }
                  />
                </div>
              </div>

              <button
                onClick={() => fetchPreview(config.includeAiSummary)}
                disabled={previewLoading}
                className="w-full py-3 flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <RotateCw
                  size={14}
                  className={previewLoading ? "animate-spin" : ""}
                />
                Refresh Preview Data
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {loading || isFilterLoading ? (
                Array(2)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse"
                    />
                  ))
              ) : (
                <>
                  <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                      Total Scale Reach
                    </p>
                    <p className="text-2xl font-black text-gray-900 dark:text-zinc-100">
                      {scales.reduce((acc, s) => acc + s.total_assessments, 0)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Verified SME Assessments
                    </p>
                  </div>
                  <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
                      Model Precision
                    </p>
                    <p className="text-2xl font-black text-emerald-500">
                      89.1%
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Weighted System Average
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Privacy context */}
            <div className="flex items-start gap-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30 rounded-2xl px-5 py-4">
              <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700/80 dark:text-blue-400/70 leading-relaxed font-medium">
                {isAnalyst
                  ? "Your role enforces entity masking to focus on sector-wide policy insights. Individual company identifiers are suppressed."
                  : "Entity masking hashes company names in the report output. Use this when sharing reports for research or public briefings."}
              </p>
            </div>
          </div>

          {/* Right Column: Live Preview */}
          <div className="lg:col-span-7 h-full sticky top-6">
            {previewLoading && !previewData ? (
              <div className="h-[600px] rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center space-y-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center animate-bounce",
                    accentBg
                  )}
                >
                  <Eye size={24} className={accentColor} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">
                  Generating Live Preview...
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in zoom-in-95 duration-700 h-full">
                <InstitutionalReportPreview
                  data={previewData}
                  role={userRole}
                  config={config}
                />
              </div>
            )}
          </div>
        </div>

        {/* Technical Data Section (Lower down) */}
        <div className="pt-12 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
            <TrendingUp size={18} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-widest">
              Dataset Integrity Audit
            </h2>
          </div>

          {/* Tables (Refactored to be cleaner) */}
          {loading || isFilterLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className={cn("animate-spin", accentColor)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Model Performance Table */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-6 py-4 border-b border-gray-100/50 dark:border-white/10 flex justify-between items-center">
                  <h2 className="text-xs font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-wider">
                    Model Outcomes
                  </h2>
                  <TrendingUp size={14} className="text-gray-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
                      <tr>
                        {["Model", "Assessments", "Distress Rate"].map((h) => (
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
                            {(m.distress_rate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scale Table */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-6 py-4 border-b border-gray-100/50 dark:border-white/10 flex justify-between items-center">
                  <h2 className="text-xs font-bold text-gray-800 dark:text-zinc-100 uppercase tracking-wider">
                    Scale Segmentation
                  </h2>
                  <Building2 size={14} className="text-gray-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
                      <tr>
                        {["Scale", "Assessments", "Avg Prob."].map((h) => (
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
                      {scales.map((s) => (
                        <tr key={s.scale}>
                          <td className="px-5 py-3 font-semibold text-gray-700 dark:text-zinc-200">
                            {s.scale}
                          </td>
                          <td className="px-5 py-3 tabular-nums">
                            {s.total_assessments}
                          </td>
                          <td className="px-5 py-3 font-mono text-gray-500">
                            {(s.avg_distress_prob * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <InstitutionalExportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isFullRegulator={isFullReg}
        config={config}
      />
    </>
  );
}
