"use client";

/**
 * FinWatch Zambia - Regulator Settings
 *
 * Profile management, security credentials, appearance preferences,
 * account information, and sign out functionality.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  User,
  Lock,
  Palette,
  Info,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Shield,
  Calendar,
  Clock,
  BadgeCheck,
  Save,
  LogOut,
} from "lucide-react";
import api from "@/lib/api";
import { clearRegToken, getRegUser } from "@/lib/regulator-auth";
import { useRouter } from "next/navigation";

// Types

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

type TabKey = "profile" | "security" | "appearance" | "account" | "danger";

// Helpers

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// Reusable field + feedback components

function FieldGroup({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

function FeedbackBanner({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  const styles =
    type === "success"
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400";
  const Icon = type === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm ${styles}`}
    >
      <Icon size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="text-xs underline opacity-60 hover:opacity-100 flex-shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="border-b border-gray-50 dark:border-zinc-800 pb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// Tab nav

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <User size={15} /> },
  { key: "security", label: "Security", icon: <Lock size={15} /> },
  { key: "appearance", label: "Appearance", icon: <Palette size={15} /> },
  { key: "account", label: "System Info", icon: <Info size={15} /> },
  { key: "danger", label: "Sign Out", icon: <LogOut size={15} /> },
];

// Sections

function ProfileSection({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const isDirty = fullName !== profile.full_name || email !== profile.email;

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      setError("Full name cannot be empty.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.put<UserProfile>("/api/auth/me", {
        full_name: fullName.trim(),
        email: email.trim(),
      });
      onUpdated(res.data);
      // Update cached user
      localStorage.setItem("reg_user", JSON.stringify(res.data));
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Failed to update profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [fullName, email, onUpdated]);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Regulator Information"
        description="Update your display name and email address for institutional correspondence."
      >
        <FieldGroup label="Full Name">
          <TextInput
            value={fullName}
            onChange={setFullName}
            placeholder="Institutional name"
          />
        </FieldGroup>

        <FieldGroup
          label="Email Address"
          hint="Changing your email will require you to log in again on your next session."
        >
          <TextInput
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="analyst@institution.zm"
          />
        </FieldGroup>

        <FeedbackBanner
          type="success"
          message={success}
          onDismiss={() => setSuccess("")}
        />
        <FeedbackBanner
          type="error"
          message={error}
          onDismiss={() => setError("")}
        />

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={!isDirty || loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm bg-emerald-600"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={13} /> Save Changes
              </>
            )}
          </button>
        </div>
      </SectionCard>

      {/* Read-only identity info */}
      <SectionCard
        title="Institutional Identity"
        description="Verified system credentials for the regulator portal."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: "User ID",
              value: `#${profile.id}`,
              icon: <BadgeCheck size={13} className="text-emerald-500" />,
            },
            {
              label: "Account Role",
              value:
                profile.role === "regulator" ? "Regulator" : "Policy Analyst",
              icon: <Shield size={13} className="text-emerald-500" />,
            },
            {
              label: "Account Status",
              value: profile.is_active ? "Verified" : "Deactivated",
              icon: (
                <CheckCircle2
                  size={13}
                  className={
                    profile.is_active ? "text-green-500" : "text-red-500"
                  }
                />
              ),
            },
            {
              label: "Member Since",
              value: formatDate(profile.created_at),
              icon: <Calendar size={13} className="text-emerald-500" />,
            },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3"
            >
              <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 border border-gray-100 dark:border-zinc-600 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide font-medium">
                  {label}
                </p>
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function SecuritySection({ profile }: { profile: UserProfile }) {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Password strength
  const strength = useMemo(() => {
    if (newPw.length === 0) return null;
    if (newPw.length < 8)
      return { label: "Too short", color: "bg-red-400", pct: 25 };
    if (newPw.length < 10)
      return { label: "Weak", color: "bg-amber-400", pct: 50 };
    const hasUpper = /[A-Z]/.test(newPw);
    const hasNumber = /[0-9]/.test(newPw);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPw);
    const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (score === 3)
      return { label: "Strong", color: "bg-green-500", pct: 100 };
    if (score === 2) return { label: "Good", color: "bg-blue-400", pct: 75 };
    return { label: "Fair", color: "bg-amber-400", pct: 50 };
  }, [newPw]);

  const handleChange = useCallback(async () => {
    if (!current.trim()) {
      setError("Current password is required.");
      return;
    }
    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/api/auth/change-password", {
        current_password: current,
        new_password: newPw,
      });
      setSuccess(
        "Password changed successfully. Your next login will use the new password.",
      );
      setCurrent("");
      setNewPw("");
      setConfirm("");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 400) {
        setError(
          typeof detail === "string"
            ? detail
            : "Current password is incorrect.",
        );
      } else {
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [current, newPw, confirm]);

  const PasswordInput = useCallback(
    ({
      value,
      onChange,
      show,
      onToggle,
      placeholder,
    }: {
      value: string;
      onChange: (v: string) => void;
      show: boolean;
      onToggle: () => void;
      placeholder: string;
    }) => {
      return (
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 pr-10 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 transition-all"
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      );
    },
    [],
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title="Security Credentials"
        description="Update your portal access password. Institutional policy requires at least 8 characters."
      >
        <FieldGroup label="Current Password">
          <PasswordInput
            value={current}
            onChange={setCurrent}
            show={showCur}
            onToggle={() => setShowCur((s) => !s)}
            placeholder="Enter current password"
          />
        </FieldGroup>

        <FieldGroup label="New Password">
          <PasswordInput
            value={newPw}
            onChange={setNewPw}
            show={showNew}
            onToggle={() => setShowNew((s) => !s)}
            placeholder="Enter new password"
          />
          {strength && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: `${strength.pct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                {strength.label}
              </p>
            </div>
          )}
        </FieldGroup>

        <FieldGroup label="Confirm New Password">
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            show={showConf}
            onToggle={() => setShowConf((s) => !s)}
            placeholder="Repeat new password"
          />
          {confirm && newPw && confirm !== newPw && (
            <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
              <AlertTriangle size={10} /> Passwords do not match
            </p>
          )}
          {confirm && newPw && confirm === newPw && (
            <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={10} /> Passwords match
            </p>
          )}
        </FieldGroup>

        <FeedbackBanner
          type="success"
          message={success}
          onDismiss={() => setSuccess("")}
        />
        <FeedbackBanner
          type="error"
          message={error}
          onDismiss={() => setError("")}
        />

        <div className="flex justify-end pt-1">
          <button
            onClick={handleChange}
            disabled={loading || !current || !newPw || !confirm}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm bg-emerald-600"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Updating…
              </>
            ) : (
              <>
                <Lock size={13} /> Update Password
              </>
            )}
          </button>
        </div>
      </SectionCard>

      {/* Session info */}
      <SectionCard
        title="Access Logs"
        description="Audit trail of your recent activity on the portal."
      >
        <div className="space-y-3">
          {[
            {
              label: "Last Authorised Login",
              value: formatDateTime(profile.last_login_at),
              sub: timeAgo(profile.last_login_at),
              icon: <Clock size={13} className="text-emerald-500" />,
            },
            {
              label: "Account Registered",
              value: formatDateTime(profile.created_at),
              sub: `${Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)} days ago`,
              icon: <Calendar size={13} className="text-emerald-500" />,
            },
            {
              label: "Last Credential Sync",
              value: formatDateTime(profile.updated_at),
              sub: timeAgo(profile.updated_at),
              icon: <User size={13} className="text-emerald-500" />,
            },
          ].map(({ label, value, sub, icon }) => (
            <div
              key={label}
              className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-zinc-200">
                    {label}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                    {sub}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono text-right">
                {value}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Portal Theme"
        description="Choose your preferred display mode for the regulator interface."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                value: "light",
                label: "Light Mode",
                sub: "Clean white interface",
                icon: <Sun size={20} className="text-amber-500" />,
              },
              {
                value: "dark",
                label: "Dark Mode",
                sub: "Emerald low-light theme",
                icon: <Moon size={20} className="text-emerald-400" />,
              },
            ] as const
          ).map(({ value, label, sub, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`text-left flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                theme === value
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700"
                  : "border-gray-200 dark:border-zinc-700 hover:border-emerald-200 dark:hover:border-emerald-900"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  theme === value
                    ? "bg-emerald-100 dark:bg-emerald-900/40"
                    : "bg-gray-100 dark:bg-zinc-800"
                }`}
              >
                {icon}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    theme === value
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-gray-800 dark:text-zinc-100"
                  }`}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  {sub}
                </p>
              </div>
              {theme === value && (
                <CheckCircle2
                  size={16}
                  className="text-emerald-600 dark:text-emerald-400 ml-auto flex-shrink-0"
                />
              )}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function AccountSection({ profile }: { profile: UserProfile }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Account Profile Summary"
        description="Detailed overview of your portal account."
      >
        <div className="space-y-0 divide-y divide-gray-50 dark:divide-zinc-800">
          {[
            { label: "Internal User ID", value: `#${profile.id}`, mono: true },
            { label: "Display Name", value: profile.full_name, mono: false },
            { label: "Verified Email", value: profile.email, mono: false },
            {
              label: "Account Role",
              value: profile.role.replace("_", " ").toUpperCase(),
              mono: false,
            },
            {
              label: "Account Status",
              value: profile.is_active ? "Active" : "Inactive",
              mono: false,
            },
            {
              label: "Creation Date",
              value: formatDateTime(profile.created_at),
              mono: true,
            },
            {
              label: "Last Activity",
              value: formatDateTime(profile.updated_at),
              mono: true,
            },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
                {label}
              </p>
              <p
                className={`text-sm text-gray-800 dark:text-zinc-100 ${mono ? "font-mono" : "font-medium"}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Governance & Transparency"
        description="Institutional data handling policies."
      >
        <ul className="space-y-3">
          {[
            {
              heading: "Data Anonymisation Protocol",
              body: "The portal automatically suppresses sectors with fewer than 3 companies to prevent re-identification. No PII is exposed to any regulator or analyst.",
            },
            {
              heading: "Role-Based Access Control (RBAC)",
              body: "Policy Analysts have read-only access to aggregate metrics. Only Regulators can access anonymised high-risk flags and data exports.",
            },
            {
              heading: "Interpretation Guardrails",
              body: "ML predictions are provided as risk probabilities based on the Polish Companies Bankruptcy dataset. SHAP values are included to explain model reasoning.",
            },
            {
              heading: "Audit Trail",
              body: "All access to sensitive endpoints (anomalies, exports) is logged with a timestamp and user ID for transparency and compliance.",
            },
          ].map(({ heading, body }) => (
            <li key={heading} className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                {heading}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function DangerSection() {
  const router = useRouter();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  function handleSignOut() {
    clearRegToken();
    router.replace("/login");
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Sign Out"
        description="End your authorised session. All portal activity will be logged out."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">
              Sign out of Portal
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              Securely end your regulator session.
            </p>
          </div>
          {!confirmSignOut ? (
            <button
              onClick={() => setConfirmSignOut(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <LogOut size={13} /> Sign Out
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Confirm Sign Out
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// Page

export default function RegulatorSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // We can use the same /me endpoint but the Axios interceptor will use reg_token
    api
      .get<UserProfile>("/api/auth/me")
      .then((r) => setProfile(r.data))
      .catch(() => setError("Failed to load profile. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 pb-20 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
          Regulator Settings
        </h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
          Manage your portal access, security, and institutional profile.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <AlertTriangle size={28} className="text-red-300" />
          <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
        </div>
      ) : (
        profile && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar nav */}
            <nav className="lg:w-52 flex-shrink-0">
              <div className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
                {TABS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 lg:w-full text-left
                    ${
                      activeTab === key
                        ? key === "danger"
                          ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-4">
              {activeTab === "profile" && (
                <ProfileSection profile={profile} onUpdated={setProfile} />
              )}
              {activeTab === "security" && (
                <SecuritySection profile={profile} />
              )}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "account" && <AccountSection profile={profile} />}
              {activeTab === "danger" && <DangerSection />}
            </div>
          </div>
        )
      )}

      {/* Fixed Footer with blurred glass effect */}
    </div>
  );
}
