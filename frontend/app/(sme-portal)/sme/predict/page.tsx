"use client";

/**
 * FinWatch Zambia - SME Prediction Flow
 *
 * Three-step wizard for running financial distress predictions:
 * 1. Select company, 2. Enter financial data, 3. View results.
 */

import { useState, useEffect, useRef } from "react";
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  TrendingUp,
  Info,
  AlertTriangle,
  Check,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  History,
  Keyboard,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import api from "@/lib/api";
import { PredictionResult } from "@/components/dashboard/predict/PredictionResult";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { GlossaryTooltip } from "@/components/shared/GlossaryTooltip";

// Types

interface Company {
  id: number;
  name: string;
  industry: string | null;
}

interface Prediction {
  id: number;
  company_id: number;
  company_name: string;
  period: string;
  model_used: string;
  risk_label: string;
  distress_probability: number;
  predicted_at: string;
  inputs?: {
    current_assets: number;
    current_liabilities: number;
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    inventory: number;
    cash_and_equivalents: number;
    retained_earnings: number;
    revenue: number;
    net_income: number;
    ebit: number;
    interest_expense: number;
  };
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

// Field definitions
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

// Step indicator

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

// Number input component

function NumberField({
  fieldKey,
  label,
  value,
  signed,
  hint,
  businessScale,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: string;
  signed?: boolean;
  hint?: string;
  businessScale?: "small_scale" | "medium_scale" | null;
  onChange: (key: string, val: string) => void;
}) {
  const [localError, setLocalError] = useState("");

  const handleInputChange = (raw: string) => {
    // 1. Auto-sanitize: remove commas and spaces
    let sanitized = raw.replace(/[,\s]/g, "");

    // 2. Validate format: Digits, one decimal point, optional leading minus if signed
    // We use a regex that matches valid numeric partial input
    const numericRegex = signed ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;

    if (sanitized !== "" && !numericRegex.test(sanitized)) {
      setLocalError(`Invalid character in ${label}. Please use numbers only.`);
    } else {
      setLocalError("");
    }

    onChange(fieldKey, sanitized);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-1 mb-1.5 px-1">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-bold text-gray-700 dark:text-zinc-300">
            {label}
          </label>
          {signed && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 uppercase tracking-tighter">
              signed
            </span>
          )}
        </div>
        <GlossaryTooltip termKey={fieldKey} businessScale={businessScale} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={signed ? "e.g. -50000 or 120000" : "e.g. 250000"}
        className={cn(
          "w-full border bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all",
          localError
            ? "border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/40"
            : "border-gray-200 dark:border-zinc-700 focus:border-purple-400 focus:ring-purple-100 dark:focus:ring-purple-900/40",
        )}
      />
      {localError && (
        <p className="text-[10px] text-red-500 mt-1.5 font-bold flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
          <AlertTriangle size={10} /> {localError}
        </p>
      )}
      {hint && !localError && (
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
          <Info size={9} /> {hint}
        </p>
      )}
    </div>
  );
}

// Page

const STORAGE_KEY = "prediction_draft";

const ESTIMATION_QUESTIONS = [
  {
    id: "cash",
    question: "At the end of a typical week, do you have enough cash to cover your immediate supplier payments?",
    options: [
      { label: "Always", value: "always" },
      { label: "Usually", value: "usually" },
      { label: "Sometimes", value: "sometimes" },
      { label: "Rarely", value: "rarely" },
      { label: "Never", value: "never" },
    ]
  },
  {
    id: "debt",
    question: "Do you currently owe money to suppliers or lenders?",
    options: [
      { label: "No / Very little", value: "no" },
      { label: "A little", value: "a_little" },
      { label: "Some", value: "some" },
      { label: "A lot", value: "a_lot" },
      { label: "Very much", value: "very_much" },
    ]
  },
  {
    id: "profit",
    question: "Was your business profitable in the last three months?",
    options: [
      { label: "Yes, very", value: "yes_very" },
      { label: "Yes", value: "yes" },
      { label: "Breaking even", value: "break_even" },
      { label: "Losing a bit", value: "losing_a_bit" },
      { label: "Losing a lot", value: "losing_a_lot" },
    ]
  },
  {
    id: "solvency",
    question: "If you needed to pay all your debts today, could you?",
    options: [
      { label: "Yes, easily", value: "yes_easily" },
      { label: "Yes", value: "yes" },
      { label: "Maybe", value: "maybe" },
      { label: "Probably not", value: "probably_not" },
      { label: "Definitely not", value: "definitely_not" },
    ]
  },
  {
    id: "turnover",
    question: "How quickly do you sell through your stock or complete your services?",
    options: [
      { label: "Very quickly", value: "very_fast" },
      { label: "Quickly", value: "fast" },
      { label: "Average", value: "average" },
      { label: "Slowly", value: "slow" },
      { label: "Very slowly", value: "very_slow" },
    ]
  },
  {
    id: "interest",
    question: "Do you pay interest on any loans?",
    options: [
      { label: "No / Not applicable", value: "no_debt" },
      { label: "Yes, pay easily", value: "easily" },
      { label: "Usually on time", value: "usually" },
      { label: "Sometimes struggle", value: "sometimes" },
      { label: "With difficulty", value: "difficulty" },
      { label: "Not at all / Defaulting", value: "not_at_all" },
    ]
  }
];

const ESTIMATION_RATIO_MAP: Record<string, any> = {
  cash: {
    always: 0.8, usually: 0.6, sometimes: 0.4, rarely: 0.2, never: 0.1
  },
  debt: {
    no: { d2a: 0.05, d2e: 0.05 },
    a_little: { d2a: 0.2, d2e: 0.25 },
    some: { d2a: 0.4, d2e: 0.7 },
    a_lot: { d2a: 0.6, d2e: 1.5 },
    very_much: { d2a: 0.8, d2e: 4.0 },
  },
  profit: {
    yes_very: { npm: 0.25, roa: 0.15 },
    yes: { npm: 0.15, roa: 0.08 },
    break_even: { npm: 0.02, roa: 0.01 },
    losing_a_bit: { npm: -0.05, roa: -0.02 },
    losing_a_lot: { npm: -0.20, roa: -0.10 },
  },
  solvency: {
    yes_easily: { cr: 2.5, qr: 2.0 },
    yes: { cr: 1.8, qr: 1.4 },
    maybe: { cr: 1.1, qr: 0.9 },
    probably_not: { cr: 0.7, qr: 0.5 },
    definitely_not: { cr: 0.4, qr: 0.3 },
  },
  turnover: {
    very_fast: 3.5, fast: 2.5, average: 1.5, slow: 0.8, very_slow: 0.3
  },
  interest: {
    no_debt: 100.0, easily: 8.0, usually: 4.0, sometimes: 1.5, difficulty: 0.8, not_at_all: 0.1
  }
};

export default function PredictPage() {
  const [step, setStep] = useState<Step>(1);
  const [scrolled, setScrolled] = useState(false);
  const [pastPredictions, setPastPredictions] = useState<Prediction[]>([]);
  const [fetchingPast, setFetchingPast] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCL] = useState(true);
  const [selectedCompany, setSC] = useState<Company | null>(null);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState<FinancialForm>(EMPTY_FORM);
  const [modelName, setModelName] = useState<
    "random_forest" | "logistic_regression"
  >("random_forest");
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const [estAnswers, setEstAnswers] = useState<Record<string, string>>({});
  const [estStep, setEstStep] = useState(0);
  const [isIndicative, setIsIndicative] = useState(false);

  // File uploads
  const [balanceSheetFile, setBalanceSheetFile] = useState<File | null>(null);
  const [incomeStatementFile, setIncomeStatementFile] = useState<File | null>(
    null,
  );
  // File name tracking for persistence (since File objects can't be stored in localStorage)
  const [balanceSheetName, setBSName] = useState<string | null>(null);
  const [incomeStatementName, setISName] = useState<string | null>(null);
  
  const [manualEntryExpanded, setManualEntryExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isHydrating = useRef(true);

  // Persistence Logic: Load on mount
  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch (e) {
        console.error("Failed to parse user", e);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.selectedCompany) setSC(data.selectedCompany);
        if (data.form) setForm(data.form);
        if (data.modelName) setModelName(data.modelName);
        if (data.result) setResult(data.result);
        if (data.manualEntryExpanded !== undefined) setManualEntryExpanded(data.manualEntryExpanded);
        if (data.uploadOpen !== undefined) setUploadOpen(data.uploadOpen);
        if (data.pastOpen !== undefined) setPastOpen(data.pastOpen);
        if (data.showGuide !== undefined) setShowGuide(data.showGuide);
        if (data.balanceSheetName) setBSName(data.balanceSheetName);
        if (data.incomeStatementName) setISName(data.incomeStatementName);
        if (data.estAnswers) setEstAnswers(data.estAnswers);
        if (data.estStep !== undefined) setEstStep(data.estStep);
        if (data.isIndicative !== undefined) setIsIndicative(data.isIndicative);
      } catch (e) {
        console.error("Failed to load saved prediction draft", e);
      }
    }
    isHydrating.current = false;
    setHydrated(true);
  }, []);

  // Persistence Logic: Save on change (ONLY after initial hydration) - DEBOUNCED for performance
  useEffect(() => {
    if (isHydrating.current || !hydrated) return;

    const timeout = setTimeout(() => {
      const dataToSave = {
        step,
        selectedCompany,
        form,
        modelName,
        result,
        manualEntryExpanded,
        uploadOpen,
        pastOpen,
        showGuide,
        balanceSheetName,
        incomeStatementName,
        estAnswers,
        estStep,
        isIndicative,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    step,
    selectedCompany,
    form,
    modelName,
    result,
    manualEntryExpanded,
    uploadOpen,
    pastOpen,
    showGuide,
    balanceSheetName,
    incomeStatementName,
    hydrated,
    estAnswers,
    estStep,
    isIndicative,
  ]);

  useEffect(() => {
    api
      .get("/api/companies/")
      .then((r) =>
        setCompanies(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])),
      )
      .catch(() => setError("Failed to load companies."))
      .finally(() => setCL(false));
  }, []);

  async function handleFetchPast() {
    if (!selectedCompany) return;
    setFetchingPast(true);
    try {
      const res = await api.get("/api/predictions/", {
        params: { company_id: selectedCompany.id, limit: 10 },
      });
      setPastPredictions(
        Array.isArray(res.data) ? res.data : (res.data?.items ?? []),
      );
      setPastOpen(true);
    } catch {
      setError("Failed to load previous assessments.");
    } finally {
      setFetchingPast(false);
    }
  }

  async function handlePopulateFromPast(predId: number) {
    setFetchingPast(true);
    setError("");
    try {
      const res = await api.get(`/api/predictions/${predId}`);
      const p = res.data as Prediction;
      if (p.inputs) {
        setForm((prev) => ({
          ...prev,
          current_assets: p.inputs!.current_assets.toString(),
          current_liabilities: p.inputs!.current_liabilities.toString(),
          total_assets: p.inputs!.total_assets.toString(),
          total_liabilities: p.inputs!.total_liabilities.toString(),
          total_equity: p.inputs!.total_equity.toString(),
          inventory: p.inputs!.inventory.toString(),
          cash_and_equivalents: p.inputs!.cash_and_equivalents.toString(),
          retained_earnings: p.inputs!.retained_earnings.toString(),
          revenue: p.inputs!.revenue.toString(),
          net_income: p.inputs!.net_income.toString(),
          ebit: p.inputs!.ebit.toString(),
          interest_expense: p.inputs!.interest_expense.toString(),
        }));
        setManualEntryExpanded(true);
        setPastOpen(false);
        setIsIndicative(false);
      }
    } catch {
      setError("Failed to retrieve assessment data.");
    } finally {
      setFetchingPast(false);
    }
  }

  function handleFieldChange(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleBackCalculate() {
    const assets = 100000;
    const d_ratios = ESTIMATION_RATIO_MAP.debt[estAnswers.debt || "some"];
    const p_ratios = ESTIMATION_RATIO_MAP.profit[estAnswers.profit || "break_even"];
    const s_ratios = ESTIMATION_RATIO_MAP.solvency[estAnswers.solvency || "maybe"];
    const cash_ratio = ESTIMATION_RATIO_MAP.cash[estAnswers.cash || "sometimes"];
    const asset_turnover = ESTIMATION_RATIO_MAP.turnover[estAnswers.turnover || "average"];
    const interest_coverage = ESTIMATION_RATIO_MAP.interest[estAnswers.interest || "usually"];

    const total_liabilities = assets * d_ratios.d2a;
    const total_equity = assets - total_liabilities;
    const current_assets = assets * 0.5;
    const current_liabilities = current_assets / s_ratios.cr;
    // Ensure inventory is not negative
    const inventory = Math.max(0, current_assets - (current_assets / s_ratios.qr));
    const cash = current_liabilities * cash_ratio;
    const revenue = assets * asset_turnover;
    const net_income = revenue * p_ratios.npm;
    const interest_expense = Math.max(10, (Math.abs(net_income) * 0.1) / interest_coverage);
    const ebit = net_income + interest_expense;
    const retained_earnings = total_equity * 0.3;

    setForm({
      period: form.period || new Date().getFullYear().toString(),
      current_assets: current_assets.toFixed(2),
      current_liabilities: current_liabilities.toFixed(2),
      total_assets: assets.toFixed(2),
      total_liabilities: total_liabilities.toFixed(2),
      total_equity: total_equity.toFixed(2),
      inventory: inventory.toFixed(2),
      cash_and_equivalents: cash.toFixed(2),
      retained_earnings: retained_earnings.toFixed(2),
      revenue: revenue.toFixed(2),
      net_income: net_income.toFixed(2),
      ebit: ebit.toFixed(2),
      interest_expense: interest_expense.toFixed(2),
    });
    setIsIndicative(true);
  }

  const currentEstQ = ESTIMATION_QUESTIONS[estStep];

  function handleClearBalanceSheet() {
    setForm((prev) => ({
      ...prev,
      current_assets: "",
      current_liabilities: "",
      total_assets: "",
      total_liabilities: "",
      total_equity: "",
      inventory: "",
      cash_and_equivalents: "",
      retained_earnings: "",
    }));
  }

  function handleClearIncomeStatement() {
    setForm((prev) => ({
      ...prev,
      revenue: "",
      interest_expense: "",
      net_income: "",
      ebit: "",
    }));
  }

  function handleClearAllManual() {
    setForm(EMPTY_FORM);
    setBalanceSheetFile(null);
    setIncomeStatementFile(null);
    setBSName(null);
    setISName(null);
    setError("");
  }

  function handleRemoveFiles() {
    setBalanceSheetFile(null);
    setIncomeStatementFile(null);
    setBSName(null);
    setISName(null);
  }

  // Auto-extraction Effect: Trigger when files change
  useEffect(() => {
    if (balanceSheetFile || incomeStatementFile) {
      handleExtractData();
    }
  }, [balanceSheetFile, incomeStatementFile]);

  async function handleExtractData() {
    if (!balanceSheetFile && !incomeStatementFile) {
      setError("Please upload at least one document for extraction.");
      return;
    }

    setExtracting(true);
    setError("");

    try {
      const formData = new FormData();
      if (balanceSheetFile) formData.append("files", balanceSheetFile);
      if (incomeStatementFile) formData.append("files", incomeStatementFile);

      const res = await api.post("/api/predictions/extract-data", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const extracted = res.data;
      setForm((prev) => ({
        ...prev,
        current_assets:
          extracted.current_assets?.toString() || prev.current_assets,
        current_liabilities:
          extracted.current_liabilities?.toString() || prev.current_liabilities,
        total_assets: extracted.total_assets?.toString() || prev.total_assets,
        total_liabilities:
          extracted.total_liabilities?.toString() || prev.total_liabilities,
        total_equity: extracted.total_equity?.toString() || prev.total_equity,
        inventory: extracted.inventory?.toString() || prev.inventory,
        cash_and_equivalents:
          extracted.cash_and_equivalents?.toString() ||
          prev.cash_and_equivalents,
        retained_earnings:
          extracted.retained_earnings?.toString() || prev.retained_earnings,
        revenue: extracted.revenue?.toString() || prev.revenue,
        net_income: extracted.net_income?.toString() || prev.net_income,
        ebit: extracted.ebit?.toString() || prev.ebit,
        interest_expense:
          extracted.interest_expense?.toString() || prev.interest_expense,
      }));
      setManualEntryExpanded(true);
      setIsIndicative(false);
    } catch (err: any) {
      setError(
        "Failed to extract data from documents. Please try manual entry.",
      );
    } finally {
      setExtracting(false);
    }
  }

  function validateForm(): string {
    const period = form.period.trim().toUpperCase();
    if (!period) return "Reporting period is required (e.g., 2024 or 2024-Q3).";

    // Format Check: YYYY or YYYY-QX
    const periodMatch = period.match(/^(\d{4})(?:-Q([1-4]))?$/);
    if (!periodMatch) {
      return "Invalid period format. Please use 'YYYY' (e.g., 2024) or 'YYYY-QX' (e.g., 2024-Q3).";
    }

    const year = parseInt(periodMatch[1]);
    const quarter = periodMatch[2] ? parseInt(periodMatch[2]) : null;

    const minYear = 2010;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    if (year < minYear) {
      return `Reporting period cannot be earlier than ${minYear}. The system requires more recent data for accurate predictions.`;
    }
    if (year > currentYear) {
      return `Reporting period cannot exceed the current year (${currentYear}).`;
    }
    if (year === currentYear && quarter && quarter > currentQuarter) {
      return `Reporting period cannot be earlier than ${minYear}. The system requires more recent data for accurate predictions.`;
    }

    const requiredMetrics: (keyof FinancialForm)[] = [
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

    const isFormEmpty = requiredMetrics.every((k) => form[k].trim() === "");
    const areFilesMissing = !balanceSheetFile && !incomeStatementFile;

    // 1. Holistic Check: Nothing provided at all
    if (isFormEmpty && areFilesMissing) {
      return "Financial data required. Please upload documents for extraction or enter all data manually.";
    }

    // 2. Flow Guidance: Files present but extraction not run (and form empty)
    if (!areFilesMissing && isFormEmpty) {
      return "Documents detected. Please click 'Extract Financial Data' or enter values manually to proceed.";
    }

    // 3. Metric Completeness Check (Regardless of source)
    for (const key of requiredMetrics) {
      if (form[key].trim() === "")
        return `${key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} is required. Please fill in manually or upload a document containing this value.`;
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

      // Step B - run prediction
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
    setBalanceSheetFile(null);
    setIncomeStatementFile(null);
    setBSName(null);
    setISName(null);
    setManualEntryExpanded(false);
    setResult(null);
    setError("");
    setModelName("random_forest");
    setEstAnswers({});
    setEstStep(0);
    setIsIndicative(false);
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollArea = document.getElementById("main-scroll-area");
      setScrolled((scrollArea?.scrollTop || 0) > 20);
    };
    const scrollArea = document.getElementById("main-scroll-area");
    scrollArea?.addEventListener("scroll", handleScroll);
    return () => scrollArea?.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="px-6 pb-20 max-w-screen-2xl mx-auto">
      {/* Sticky Header Pill */}
      <div
        className={cn(
          "sticky top-4 z-20 mb-8 transition-all duration-500 ease-in-out",
          scrolled
            ? "bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl px-6 py-4 shadow-xl translate-y-2 max-w-4xl mx-auto"
            : "bg-transparent border-transparent px-0 py-0",
        )}
      >
        <div
          className={cn(
            "flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-500",
            scrolled ? "space-y-0" : "space-y-6",
          )}
        >
          {/* Page header */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 transition-all duration-500",
                scrolled ? "w-8 h-8" : "w-10 h-10",
              )}
            >
              <TrendingUp
                size={scrolled ? 16 : 20}
                className="text-purple-600 dark:text-purple-400"
              />
            </div>
            <div>
              <h1
                className={cn(
                  "font-bold text-gray-900 dark:text-zinc-100 transition-all duration-500",
                  scrolled ? "text-base" : "text-lg",
                )}
              >
                New Prediction
              </h1>
              {!scrolled && (
                <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
                  Run a financial distress assessment for an SME
                </p>
              )}
            </div>
          </div>

          {/* Step indicators */}
          {step < 3 && (
            <div
              className={cn(
                "flex items-center gap-2 transition-all duration-500",
                scrolled ? "scale-90 origin-right" : "",
              )}
            >
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
        </div>
      </div>

      {/* STEP 1 - Select Company */}
      {step === 1 && (
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-6 space-y-4 shadow-sm dark:shadow-none animate-in fade-in slide-in-from-bottom-2">
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
                href="/sme/companies"
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

          <div className="flex justify-center pt-2">
            <button
              disabled={!selectedCompany}
              onClick={() => {
                setError("");
                setStep(2);
              }}
              className="flex items-center gap-2 px-8 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              Continue <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 - Financial Data */}
      {step === 2 && (
        <div className="space-y-4">
          {user?.business_scale === "small_scale" ? (
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-8 shadow-sm dark:shadow-none animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Indicative Assessment</h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Answer a few simple questions about your business operations.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Question</span>
                    <p className="text-lg font-mono font-bold text-gray-900 dark:text-zinc-100">{estStep + 1} / {ESTIMATION_QUESTIONS.length}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full mb-10 overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500 ease-out"
                    style={{ width: `${((estStep + 1) / ESTIMATION_QUESTIONS.length) * 100}%` }}
                  />
                </div>

                <div className="space-y-8 min-h-[300px]">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-200 leading-relaxed">
                    {currentEstQ.question}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {currentEstQ.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setEstAnswers({ ...estAnswers, [currentEstQ.id]: opt.value });
                          if (estStep < ESTIMATION_QUESTIONS.length - 1) {
                            setEstStep(estStep + 1);
                          }
                        }}
                        className={cn(
                          "w-full text-left px-6 py-4 rounded-2xl border-2 transition-all group",
                          estAnswers[currentEstQ.id] === opt.value
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 shadow-md"
                            : "border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-purple-200 dark:hover:border-purple-900/40 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-bold transition-colors",
                            estAnswers[currentEstQ.id] === opt.value ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-zinc-300"
                          )}>
                            {opt.label}
                          </span>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                            estAnswers[currentEstQ.id] === opt.value ? "border-purple-500 bg-purple-500" : "border-gray-300 dark:border-zinc-700"
                          )}>
                            {estAnswers[currentEstQ.id] === opt.value && <Check size={12} className="text-white" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      if (estStep > 0) setEstStep(estStep - 1);
                      else setStep(1);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:text-purple-600 transition-colors"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>

                  {estStep === ESTIMATION_QUESTIONS.length - 1 && estAnswers[currentEstQ.id] ? (
                    <button
                      onClick={() => {
                        handleBackCalculate();
                        handleRunPrediction();
                      }}
                      disabled={submitting}
                      className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Run Indicative Assessment <ChevronRight size={16} /></>}
                    </button>
                  ) : null}
                </div>

                <div className="mt-8 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/30 flex items-start gap-3">
                  <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Note:</strong> This assessment is based on estimated inputs. For a more accurate result, complete the full financial form.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Period */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-none animate-in fade-in slide-in-from-right-4 duration-500">
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

              {/* Financial Document Upload */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <button
                  type="button"
                  onClick={() => setUploadOpen(!uploadOpen)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Upload size={16} className="text-purple-600" />
                    <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      Financial Document Upload
                    </h2>
                  </div>
                  {uploadOpen ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </button>

                {uploadOpen && (
                  <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 mb-2">
                      Upload Balance Sheet and Income Statement (PDF, CSV, XLSX, or
                      XLS) to automatically extract data.
                    </p>

                    {/* Requirements Guide Trigger */}
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-all mb-5 uppercase tracking-wider group"
                    >
                      <Info
                        size={12}
                        className="group-hover:scale-110 transition-transform"
                      />
                      {showGuide ? "Hide" : "View"} Document Requirements
                    </button>

                    {/* Requirements Guide Panel */}
                    {showGuide && (
                      <div className="mb-6 p-5 rounded-2xl bg-purple-50/40 dark:bg-purple-900/10 border border-purple-100/50 dark:border-purple-800/30 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {/* Balance Sheet section */}
                          <div>
                            <h4 className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <div className="w-1 h-3 bg-purple-500 rounded-full" />
                              Balance Sheet Metrics
                            </h4>
                            <ul className="grid grid-cols-2 gap-y-2 gap-x-4">
                              {BALANCE_SHEET_FIELDS.map((f) => (
                                <li
                                  key={f.key}
                                  className="text-[11px] text-gray-600 dark:text-zinc-400 flex items-center gap-2 font-medium"
                                >
                                  <Check
                                    size={10}
                                    className="text-purple-500 flex-shrink-0"
                                  />
                                  <span className="truncate">{f.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Income Statement section */}
                          <div>
                            <h4 className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <div className="w-1 h-3 bg-purple-500 rounded-full" />
                              Income Statement Metrics
                            </h4>
                            <ul className="grid grid-cols-1 gap-y-2">
                              {INCOME_FIELDS.map((f) => (
                                <li
                                  key={f.key}
                                  className="text-[11px] text-gray-600 dark:text-zinc-400 flex items-center gap-2 font-medium"
                                >
                                  <Check
                                    size={10}
                                    className="text-purple-500 flex-shrink-0"
                                  />
                                  <span>{f.label}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-purple-100/50 dark:border-purple-800/30 flex items-center flex-wrap gap-2.5">
                          <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-tight mr-1">
                            Accepted Formats:
                          </span>
                          {["PDF", "CSV", "XLSX", "XLS"].map((fmt) => (
                            <span
                              key={fmt}
                              className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 shadow-sm"
                            >
                              {fmt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Balance Sheet Upload */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-tight">
                          Balance Sheet
                        </label>
                        <div
                          className={`relative group border-2 border-dashed rounded-xl p-4 transition-all ${
                            balanceSheetFile
                              ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                              : "border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/40 bg-gray-50/50 dark:bg-zinc-800/50"
                          }`}
                        >
                          <input
                            type="file"
                            accept=".pdf,.csv,.xlsx,.xls"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setBalanceSheetFile(f);
                              setBSName(f?.name || null);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center justify-center text-center gap-2">
                            {balanceSheetName ? (
                              <>
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                                  <Check size={16} />
                                </div>
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate w-full px-2">
                                  {balanceSheetName}
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 group-hover:text-purple-500 transition-colors">
                                  <FileText size={16} />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-zinc-500">
                                  Click or drag Balance Sheet
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Income Statement Upload */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-tight">
                          Income Statement
                        </label>
                        <div
                          className={`relative group border-2 border-dashed rounded-xl p-4 transition-all ${
                            incomeStatementName
                              ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                              : "border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/40 bg-gray-50/50 dark:bg-zinc-800/50"
                          }`}
                        >
                          <input
                            type="file"
                            accept=".pdf,.csv,.xlsx,.xls"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setIncomeStatementFile(f);
                              setISName(f?.name || null);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center justify-center text-center gap-2">
                            {incomeStatementName ? (
                              <>
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                                  <Check size={16} />
                                </div>
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate w-full px-2">
                                  {incomeStatementName}
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 group-hover:text-purple-500 transition-colors">
                                  <FileText size={16} />
                                </div>
                                <p className="text-xs text-gray-400 dark:text-zinc-500">
                                  Click or drag Income Statement
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleExtractData}
                        disabled={
                          (!balanceSheetFile && !incomeStatementFile) || extracting
                        }
                        className={cn(
                          "flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50",
                          form.revenue
                            ? "bg-emerald-600 text-white"
                            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        )}
                      >
                        {extracting ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> {form.revenue ? "Updating Data..." : "Extracting Data..."}
                          </>
                        ) : form.revenue ? (
                          <>
                            <Check size={12} /> Financial Data Extracted
                          </>
                        ) : (
                          <>
                            <TrendingUp size={12} /> Extract Financial Data
                          </>
                        )}
                      </button>

                      {(balanceSheetName || incomeStatementName) && (
                        <button
                          type="button"
                          onClick={handleRemoveFiles}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                        >
                          <Trash2 size={12} /> Remove Documents
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Re-use Previous Data */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none animate-in fade-in slide-in-from-right-4 duration-500">
                <button
                  type="button"
                  onClick={() => {
                    if (pastOpen) setPastOpen(false);
                    else handleFetchPast();
                  }}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-purple-600" />
                    <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      Re-use Previous Assessment Data
                    </h2>
                  </div>
                  {fetchingPast ? (
                    <Loader2 size={16} className="animate-spin text-purple-400" />
                  ) : pastOpen ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </button>

                {pastOpen && (
                  <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    {pastPredictions.length === 0 ? (
                      <p className="text-center py-4 text-xs text-gray-400 dark:text-zinc-500">
                        No previous assessments found for this company.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {pastPredictions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handlePopulateFromPast(p.id)}
                            className="flex flex-col text-left p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-all"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-800 dark:text-zinc-100">
                                {p.period}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(p.predicted_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                p.risk_label === 'Distressed' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                              }`}>
                                {p.risk_label}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {p.model_used === 'random_forest' ? 'R-Forest' : 'Log-Reg'}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Entry (Collapsible) */}
              <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none animate-in fade-in slide-in-from-right-4 duration-500">
                <button
                  type="button"
                  onClick={() => setManualEntryExpanded(!manualEntryExpanded)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Keyboard size={16} className="text-purple-600" />
                    <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                      Manual Entry
                    </h2>
                  </div>
                  {manualEntryExpanded ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </button>

                {manualEntryExpanded && (
                  <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Inner Balance Sheet Card */}
                    <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-xl">
                      <h3 className="text-[11px] font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-widest mb-4">
                        Balance Sheet (ZMW)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {BALANCE_SHEET_FIELDS.map((f) => (
                          <NumberField
                            key={f.key}
                            fieldKey={f.key}
                            label={f.label}
                            value={form[f.key]}
                            signed={f.signed}
                            hint={f.hint}
                            businessScale={user?.business_scale}
                            onChange={handleFieldChange}
                          />
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleClearBalanceSheet}
                          className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw size={10} /> Clear Balance Sheet
                        </button>
                      </div>
                    </div>

                    {/* Inner Income Statement Card */}
                    <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 border border-gray-100 dark:border-zinc-800 rounded-xl">
                      <h3 className="text-[11px] font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-widest mb-4">
                        Income Statement (ZMW)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {INCOME_FIELDS.map((f) => (
                          <NumberField
                            key={f.key}
                            fieldKey={f.key}
                            label={f.label}
                            value={form[f.key]}
                            signed={f.signed}
                            hint={f.hint}
                            businessScale={user?.business_scale}
                            onChange={handleFieldChange}
                          />
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleClearIncomeStatement}
                          className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw size={10} /> Clear Income Statement
                        </button>
                      </div>
                    </div>

                    {/* Global Clear All */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleClearAllManual}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <Trash2 size={12} /> Clear All Manual Fields
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Model selection */}
              <div className="bg-purple-600 dark:bg-purple-900/60 border border-purple-500/20 dark:border-white/10 rounded-2xl p-6 shadow-xl shadow-purple-600/10 transition-all duration-500 animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-[10px] font-black text-white/60 dark:text-purple-300 uppercase tracking-[0.2em] mb-6">
                  Select AI Analysis Model
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      {
                        value: "random_forest",
                        label: "Random Forest",
                        sub: "Authoritative model with highest predictive accuracy",
                      },
                      {
                        value: "logistic_regression",
                        label: "Logistic Regression",
                        sub: "Baseline model focusing on statistical interpretability",
                      },
                    ] as const
                  ).map(({ value, label, sub }) => (
                    <button
                      key={value}
                      onClick={() => setModelName(value)}
                      className={cn(
                        "text-left px-5 py-5 rounded-2xl border-2 transition-all duration-300 relative group",
                        modelName === value
                          ? "border-white bg-white/20 text-white shadow-lg scale-[1.02] z-10"
                          : "border-white/10 bg-black/5 text-purple-100 hover:border-white/30 hover:bg-white/5 opacity-80 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-black tracking-tight uppercase">
                          {label}
                        </p>
                        {modelName === value ? (
                          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Check size={12} className="text-purple-600 font-bold" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />
                        )}
                      </div>
                      <p className="text-[11px] opacity-70 leading-relaxed font-medium">
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
            </>
          )}
        </div>
      )}

      {/* STEP 3 - Results */}
      {step === 3 && result && (
        <PredictionResult
          result={result}
          companyName={selectedCompany?.name ?? ""}
          onRunAnother={handleRunAnother}
          isIndicative={isIndicative}
          businessScale={user?.business_scale}
        />
      )}
    </div>
  );
}
