"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  TrendingUp,
  Info,
  Check,
} from "lucide-react";
import api from "@/lib/api";
import { PredictionResult } from "@/components/dashboard/predict/PredictionResult";

// ── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  industry: string | null;
}

interface FinancialForm {
  period: string;
  // Balance sheet — non-negative
  current_assets: string;
  current_liabilities: string;
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
  inventory: string;
  cash_and_equivalents: string;
  // Signed
  retained_earnings: string;
  // Income statement — non-negative
  revenue: string;
  interest_expense: string;
  // Signed
  net_income: string;
  ebit: string;
}

const EMPTY_FORM: FinancialForm = {
  period: "",
  current_assets: "",
  current_liabilities: "",
  total_assets: "",
  total_liabilities: "",
  total_equity: "",
  inventory: "",
  cash_and_equivalents: "",
  retained_earnings: "",
  revenue: "",
  interest_expense: "",
  net_income: "",
  ebit: "",
};

// Field definitions — grouped for the form
const BALANCE_SHEET_FIELDS: {
  key: keyof FinancialForm;
  label: string;
  signed?: boolean;
  hint?: string;
}[] = [
  {
    key: "current_assets",
    label: "Current Assets",
    hint: "Cash, receivables, inventory",
  },
  {
    key: "current_liabilities",
    label: "Current Liabilities",
    hint: "Debts due within 12 months",
  },
  {
    key: "total_assets",
    label: "Total Assets",
    hint: "Must be greater than zero",
  },
  {
    key: "total_liabilities",
    label: "Total Liabilities",
    hint: "All short and long-term debt",
  },
  {
    key: "total_equity",
    label: "Total Equity",
    hint: "Assets minus liabilities",
  },
  { key: "inventory", label: "Inventory", hint: "Goods held for sale" },
  {
    key: "cash_and_equivalents",
    label: "Cash & Equivalents",
    hint: "Liquid funds on hand",
  },
  {
    key: "retained_earnings",
    label: "Retained Earnings",
    hint: "Can be negative (accumulated losses)",
    signed: true,
  },
];

const INCOME_FIELDS: {
  key: keyof FinancialForm;
  label: string;
  signed?: boolean;
  hint?: string;
}[] = [
  { key: "revenue", label: "Revenue", hint: "Total sales / turnover" },
  {
    key: "net_income",
    label: "Net Income",
    hint: "Can be negative (net loss)",
    signed: true,
  },
  {
    key: "ebit",
    label: "EBIT",
    hint: "Earnings before interest & tax — can be negative",
    signed: true,
  },
  {
    key: "interest_expense",
    label: "Interest Expense",
    hint: "Cost of debt servicing",
  },
];

type Step = 1 | 2 | 3;

// ── Step indicator ───────────────────────────────────────────────────────────

function StepBadge({
  step,
  current,
  label,
}: {
  step: number;
  current: number;
  label: string;
}) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
          done
            ? "bg-purple-600 text-white"
            : active
              ? "bg-purple-600 text-white ring-4 ring-purple-100 dark:ring-purple-900/40"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
        }`}
      >
        {done ? <Check size={12} /> : step}
      </div>
      <span
        className={`text-sm font-medium hidden sm:block ${
          active
            ? "text-gray-900 dark:text-zinc-100"
            : "text-gray-400 dark:text-zinc-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Number input component ───────────────────────────────────────────────────

function NumberField({
  fieldKey,
  label,
  value,
  signed,
  hint,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: string;
  signed?: boolean;
  hint?: string;
  onChange: (key: string, val: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
          {label}
        </label>
        {signed && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">
            signed
          </span>
        )}
      </div>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={signed ? "e.g. -50000 or 120000" : "e.g. 250000"}
        className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all"
      />
      {hint && (
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
          <Info size={9} /> {hint}
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PredictPage() {
  const [step, setStep] = useState<Step>(1);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCL] = useState(true);
  const [selectedCompany, setSC] = useState<Company | null>(null);
  const [form, setForm] = useState<FinancialForm>(EMPTY_FORM);
  const [modelName, setModelName] = useState<
    "random_forest" | "logistic_regression"
  >("random_forest");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api
      .get("/api/companies/")
      .then((r) =>
        setCompanies(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])),
      )
      .catch(() => setError("Failed to load companies."))
      .finally(() => setCL(false));
  }, []);

  function handleFieldChange(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function validateForm(): string {
    if (!form.period.trim()) return "Period is required (e.g. 2024).";
    const required: (keyof FinancialForm)[] = [
      "current_assets",
      "current_liabilities",
      "total_assets",
      "total_liabilities",
      "total_equity",
      "inventory",
      "cash_and_equivalents",
      "retained_earnings",
      "revenue",
      "net_income",
      "ebit",
      "interest_expense",
    ];
    for (const key of required) {
      if (form[key].trim() === "")
        return `${key.replace(/_/g, " ")} is required.`;
    }
    if (parseFloat(form.total_assets) <= 0)
      return "Total assets must be greater than zero.";
    return "";
  }

  async function handleRunPrediction() {
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }
    if (!selectedCompany) return;

    setSubmitting(true);
    setError("");

    try {
      // Step A — create financial record
      const recordPayload = {
        period: form.period.trim(),
        current_assets: parseFloat(form.current_assets),
        current_liabilities: parseFloat(form.current_liabilities),
        total_assets: parseFloat(form.total_assets),
        total_liabilities: parseFloat(form.total_liabilities),
        total_equity: parseFloat(form.total_equity),
        inventory: parseFloat(form.inventory),
        cash_and_equivalents: parseFloat(form.cash_and_equivalents),
        retained_earnings: parseFloat(form.retained_earnings),
        revenue: parseFloat(form.revenue),
        net_income: parseFloat(form.net_income),
        ebit: parseFloat(form.ebit),
        interest_expense: parseFloat(form.interest_expense),
      };

      const recordRes = await api.post(
        `/api/companies/${selectedCompany.id}/records`,
        recordPayload,
      );
      const record = recordRes.data;

      // Step B — run prediction
      const predRes = await api.post(
        `/api/predictions/?company_id=${selectedCompany.id}&record_id=${record.id}&model_name=${modelName}`,
      );

      setResult(predRes.data);
      setStep(3);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 503) {
        setError(
          "ML models are not loaded yet. Run the training pipeline first: python ml/train.py",
        );
      } else if (
        err?.response?.status === 400 &&
        typeof detail === "string" &&
        detail.includes("period")
      ) {
        setError(
          `A financial record for period "${form.period}" already exists for this company. Use a different period.`,
        );
      } else {
        setError(
          typeof detail === "string"
            ? detail
            : "Prediction failed. Please check your inputs and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRunAnother() {
    setStep(1);
    setSC(null);
    setForm(EMPTY_FORM);
    setResult(null);
    setError("");
    setModelName("random_forest");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
          New Prediction
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
          Run a financial distress assessment for an SME
        </p>
      </div>

      {/* ── Step indicators ── */}
      {step < 3 && (
        <div className="flex items-center gap-2">
          <StepBadge step={1} current={step} label="Select Company" />
          <ChevronRight
            size={14}
            className="text-gray-300 dark:text-zinc-600 flex-shrink-0"
          />
          <StepBadge step={2} current={step} label="Financial Data" />
          <ChevronRight
            size={14}
            className="text-gray-300 dark:text-zinc-600 flex-shrink-0"
          />
          <StepBadge step={3} current={step} label="Results" />
        </div>
      )}

      {/* ══════════════ STEP 1 — Select Company ══════════════ */}
      {step === 1 && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Which company are you assessing?
            </h2>
          </div>

          {companiesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-purple-400" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400 dark:text-zinc-500 mb-2">
                No companies registered yet.
              </p>
              <a
                href="/dashboard/companies"
                className="text-xs text-purple-600 font-medium hover:underline"
              >
                Add a company first →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSC(c)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 ${
                    selectedCompany?.id === c.id
                      ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700"
                      : "border-gray-200 dark:border-zinc-700 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-semibold truncate ${
                        selectedCompany?.id === c.id
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-800 dark:text-zinc-100"
                      }`}
                    >
                      {c.name}
                    </p>
                    {selectedCompany?.id === c.id && (
                      <Check
                        size={14}
                        className="text-purple-600 flex-shrink-0 ml-1"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                    {c.industry ?? "No industry"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              disabled={!selectedCompany}
              onClick={() => {
                setError("");
                setStep(2);
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              Continue <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 2 — Financial Data ══════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Period */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
              Reporting Period
            </h2>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Period <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.period}
                onChange={(e) => handleFieldChange("period", e.target.value)}
                placeholder="e.g. 2024 or 2024-Q3"
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all"
              />
            </div>
          </div>

          {/* Balance Sheet */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
              Balance Sheet (ZMW)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BALANCE_SHEET_FIELDS.map((f) => (
                <NumberField
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  value={form[f.key]}
                  signed={f.signed}
                  hint={f.hint}
                  onChange={handleFieldChange}
                />
              ))}
            </div>
          </div>

          {/* Income Statement */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
              Income Statement (ZMW)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INCOME_FIELDS.map((f) => (
                <NumberField
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  value={form[f.key]}
                  signed={f.signed}
                  hint={f.hint}
                  onChange={handleFieldChange}
                />
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
              ML Model
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    value: "random_forest",
                    label: "Random Forest",
                    sub: "Higher accuracy · Recommended",
                  },
                  {
                    value: "logistic_regression",
                    label: "Logistic Regression",
                    sub: "More interpretable · Faster",
                  },
                ] as const
              ).map(({ value, label, sub }) => (
                <button
                  key={value}
                  onClick={() => setModelName(value)}
                  className={`text-left px-4 py-3 rounded-xl border transition-all ${
                    modelName === value
                      ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700"
                      : "border-gray-200 dark:border-zinc-700 hover:border-purple-200 dark:hover:border-purple-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-semibold ${
                        modelName === value
                          ? "text-purple-700 dark:text-purple-300"
                          : "text-gray-800 dark:text-zinc-100"
                      }`}
                    >
                      {label}
                    </p>
                    {modelName === value && (
                      <Check size={13} className="text-purple-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    {sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <ChevronLeft size={14} /> Back
            </button>

            <button
              onClick={handleRunPrediction}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Running…
                </>
              ) : (
                <>
                  <TrendingUp size={14} /> Run Prediction
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 3 — Results ══════════════ */}
      {step === 3 && result && (
        <PredictionResult
          result={result}
          companyName={selectedCompany?.name ?? ""}
          onRunAnother={handleRunAnother}
        />
      )}

      {/* ── Footer ── */}
      <p className="text-center text-[11px] text-gray-300 dark:text-zinc-600 pb-2">
        FinWatch — ML-Based Financial Distress Prediction for Zambian SMEs ·
        COM421 2026
      </p>
    </div>
  );
}
