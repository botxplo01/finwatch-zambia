"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Building2,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { AddCompanyModal } from "@/components/dashboard/companies/AddCompanyModal";
import { CompanyDetailModal } from "@/components/dashboard/companies/CompanyDetailModal";

// ── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  industry: string | null;
  registration_number: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Deterministic colour from name
  const colors = [
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${color}`}
    >
      {initials || <Building2 size={16} />}
    </div>
  );
}

// ── Company Card ─────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onClick,
}: {
  company: Company;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all duration-200 group"
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-4">
        <InitialAvatar name={company.name} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
            {company.name}
          </h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {company.industry ?? "Industry not set"}
          </p>
        </div>
      </div>

      {/* Description */}
      {company.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
          {company.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-zinc-800/50">
        <span className="text-[10px] text-gray-400">
          Added {formatDate(company.created_at)}
        </span>
        {company.registration_number && (
          <span className="text-[10px] text-gray-400 font-mono bg-gray-50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
            {company.registration_number}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  async function fetchCompanies() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/companies/");
      setCompanies(
        Array.isArray(res.data) ? res.data : (res.data?.items ?? []),
      );
    } catch {
      setError("Failed to load companies. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCompanies();
  }, []);

  function handleSelectCompany(company: Company) {
    setSelected(company);
    setDetailOpen(true);
  }

  function handleUpdated() {
    fetchCompanies();
    // Update selected company in state too
    if (selected) {
      const updated = companies.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.registration_number?.toLowerCase().includes(q),
    );
  }, [companies, search]);

  return (
    <>
      <div className="p-6 pb-24 max-w-7xl mx-auto space-y-6">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Companies</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {loading
                ? "Loading…"
                : `${companies.length} SME profile${companies.length !== 1 ? "s" : ""} registered`}
            </p>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Company</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, industry, or registration number…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/20 transition-all placeholder:text-gray-300 dark:text-gray-100"
          />
        </div>

        {/* ── Stats strip ── */}
        {!loading && companies.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Total Companies",
                value: companies.length,
                icon: <Building2 size={14} className="text-blue-500" />,
                bg: "bg-blue-50 dark:bg-blue-900/20",
              },
              {
                label: "With Predictions",
                value: "—",
                icon: <TrendingUp size={14} className="text-purple-500" />,
                bg: "bg-purple-50 dark:bg-purple-900/20",
              },
              {
                label: "Financial Records",
                value: "—",
                icon: <FileText size={14} className="text-green-500" />,
                bg: "bg-green-50 dark:bg-green-900/20",
              },
            ].map(({ label, value, icon, bg }) => (
              <div
                key={label}
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div
                  className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertTriangle size={28} className="text-red-300" />
            <p className="text-sm text-gray-400">{error}</p>
            <button
              onClick={fetchCompanies}
              className="text-xs text-purple-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        ) : companies.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-4 py-20 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Building2 size={24} className="text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                No companies yet
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                Register your first SME profile to start tracking financial
                health and running distress predictions.
              </p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
              }}
            >
              <Plus size={15} />
              Add your first company
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* No search results */
          <div className="flex flex-col items-center gap-3 py-16">
            <Search size={24} className="text-gray-300" />
            <p className="text-sm text-gray-400">
              No companies match &ldquo;{search}&rdquo;
            </p>
            <button
              onClick={() => setSearch("")}
              className="text-xs text-purple-600 font-medium hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Company grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onClick={() => handleSelectCompany(company)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed Footer with blurred glass effect */}
      

      {/* ── Modals ── */}
      <AddCompanyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={fetchCompanies}
      />

      <CompanyDetailModal
        company={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={fetchCompanies}
      />
    </>
  );
}

