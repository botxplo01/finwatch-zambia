"use client";

/**
 * FinWatch Zambia - Institutional Settings Page Component
 *
 * Profile management, security credentials, appearance preferences,
 * account information, and sign out functionality.
 */

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
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
  Camera,
  Trash2,
  Move,
  ChevronLeft,
  ChevronRight,
  Settings,
  QrCode,
  Smartphone,
  Laptop,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Pencil,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { clearInstitutionalToken, getInstitutionalUser, InstitutionalUserResponse, getInstitutionalAuthHeader } from "@/lib/institutional-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteAccountModal } from "@/components/shared/DeleteAccountModal";
import { cn, isTitleInName, getCameraPermissionState, stripMarkdown, formatDate, formatDateTime, formatTime, parseISO } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";
import { SessionRevokeModal } from "@/components/shared/SessionRevokeModal";
import { Capacitor } from "@capacitor/core";
import QRScanner from "@/components/shared/QRScanner";
import PermissionOnboarding from "@/components/shared/PermissionOnboarding";

// Types

interface UserProfile {
  id: number;
  full_name: string;
  title?: string | null;
  email: string;
  role: string;
  profile_picture_url: string | null;
  original_profile_picture_url: string | null;
  is_active: boolean;
  is_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

type TabKey = "profile" | "security" | "appearance" | "account" | "danger";

// Helpers

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - parseISO(iso).getTime();
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
  accent = "emerald",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  accent?: "emerald" | "blue";
}) {
  const borderClass =
    accent === "blue"
      ? "focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/40"
      : "focus:border-emerald-500 focus:ring-emerald-100 dark:focus:ring-emerald-900/40";
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        borderClass
      )}
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
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-none">
      <div className="border-b border-gray-100 dark:border-white/10 pb-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// Tab nav

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profile", icon: <User size={18} /> },
  { key: "appearance", label: "Appearance", icon: <Palette size={18} /> },
  { key: "account", label: "System Info", icon: <Info size={18} /> },
  { key: "security", label: "Security", icon: <Lock size={18} /> },
  { key: "danger", label: "Danger Zone", icon: <AlertTriangle size={18} /> },
];

// Sections

function ProfileSection({
  profile,
  onUpdated,
}: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile.full_name);
  const [email, setEmail] = useState(profile.email);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsExtracting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAnalyst = profile.role === "policy_analyst";
  const btnColor = isAnalyst
    ? "bg-blue-600 hover:bg-blue-700"
    : "bg-emerald-600 hover:bg-emerald-700";
  const iconColor = isAnalyst ? "text-blue-500" : "text-emerald-500";
  const accent = isAnalyst ? "blue" : "emerald";
  const accentBg = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";
  const accentText = isAnalyst
    ? "text-blue-600 dark:text-blue-300"
    : "text-emerald-600 dark:text-emerald-300";
  const accentShadow = isAnalyst
    ? "shadow-blue-600/10"
    : "shadow-emerald-600/10";

  const isDirty = fullName !== profile.full_name || email !== profile.email;

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      setError("Full name cannot be empty.");
      return;
    }

    const titleFound = isTitleInName(fullName);
    if (titleFound) {
      setError(
        `Full name should not include professional titles like '${titleFound}'. Please use the Title set during registration.`
      );
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
      localStorage.setItem("inst_user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("profile-updated"));
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Failed to update profile."
      );
    } finally {
      setLoading(false);
    }
  }, [fullName, email, onUpdated]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload an image file.",
      });
      return;
    }

    setOriginalFile(file);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setSelectedImage(reader.result?.toString() || null);
    });
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    setSelectedImage(null);
    setIsExtracting(true);
    const formData = new FormData();
    formData.append("file", croppedImage, "profile.jpg");
    if (originalFile) {
      formData.append("original", originalFile);
    }

    try {
      const res = await api.post<UserProfile>(
        "/api/auth/profile-picture",
        formData
      );
      onUpdated(res.data);
      // Update cached user
      localStorage.setItem("inst_user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("profile-updated"));
      toast({
        title: "Profile updated",
        description: "Your institutional avatar has been updated successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Could not update your avatar. Please try again.",
      });
    } finally {
      setIsExtracting(false);
      setOriginalFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePicture = async () => {
    setIsExtracting(true);
    try {
      const res = await api.delete<UserProfile>("/api/auth/profile-picture");
      onUpdated(res.data);
      localStorage.setItem("inst_user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("profile-updated"));
      toast({
        title: "Picture removed",
        description: "Your profile picture has been removed.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Operation failed",
        description: "Could not remove your profile picture.",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  const profileImageUrl = profile.profile_picture_url
    ? profile.profile_picture_url.startsWith("http")
      ? profile.profile_picture_url
      : `${
          process.env.NEXT_PUBLIC_API_URL ||
          "https://finwatch-backend.onrender.com"
        }${profile.profile_picture_url}`
    : null;

  const originalImageUrl = profile.original_profile_picture_url
    ? profile.original_profile_picture_url.startsWith("http")
      ? profile.original_profile_picture_url
      : `${
          process.env.NEXT_PUBLIC_API_URL ||
          "https://finwatch-backend.onrender.com"
        }${profile.original_profile_picture_url}`
    : profileImageUrl;

  return (
    <div className="space-y-4">
      {/* Profile Picture Card */}
      <SectionCard
        title="Institutional Avatar"
        description="Choose a professional photo for your official portal profile."
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-gray-100 dark:border-zinc-800 shadow-md">
              {profileImageUrl && (
                <AvatarImage src={profileImageUrl} alt={profile.full_name} />
              )}
              <AvatarFallback
                className={cn("text-xl font-bold", accentBg, accentText)}
              >
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  initials
                )}
              </AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full z-10">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50",
                  btnColor,
                  accentShadow
                )}
              >
                <Camera size={14} />
                {profile.profile_picture_url ? "Change" : "Upload Photo"}
              </button>

              {profile.profile_picture_url && (
                <>
                  <button
                    onClick={() => setSelectedImage(originalImageUrl)}
                    disabled={isUploading}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50",
                      isAnalyst
                        ? "border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                        : "border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                    )}
                  >
                    <Move size={14} />
                    Adjust View
                  </button>

                  <button
                    onClick={handleRemovePicture}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
              Institutional standards: JPG, PNG or SVG. Max 2MB.
            </p>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </SectionCard>

      {selectedImage && (
        <ImageCropperModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onComplete={handleCropComplete}
          portal={isAnalyst ? "analyst" : "regulator"}
        />
      )}

      <SectionCard
        title={isAnalyst ? "Analyst Information" : "Regulator Information"}
        description="Update your display name and email address for institutional correspondence."
      >
        <FieldGroup label="Full Name">
          <TextInput
            value={fullName}
            onChange={setFullName}
            placeholder="Institutional name"
            accent={accent}
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
            accent={accent}
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
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm",
              btnColor
            )}
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
        description="Verified system credentials for the portal."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: "User ID",
              value: `#${profile.id}`,
              icon: <BadgeCheck size={13} className={iconColor} />,
            },
            {
              label: "Account Role",
              value:
                profile.role === "regulator" ? "Regulator" : "Policy Analyst",
              icon: <Shield size={13} className={iconColor} />,
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
              icon: <Calendar size={13} className={iconColor} />,
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
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get("/api/auth/sessions");
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleQRClick = async () => {
    if (Capacitor.isNativePlatform()) {
      setIsScannerOpen(true);
      return;
    }
    const state = await getCameraPermissionState();
    if (state === "granted") {
      setIsScannerOpen(true);
    } else {
      setIsPermissionModalOpen(true);
    }
  };

  const handleRevokeSession = useCallback(
    async (target: { jti: string; is_current: boolean }) => {
      await api.delete(`/api/auth/sessions/${target.jti}`);
      if (target.is_current) {
        await clearInstitutionalToken();
        router.replace("/institutional/auth/login");
      } else {
        fetchSessions();
        setRevokeTarget(null);
      }
    },
    [fetchSessions, router]
  );

  const isAnalyst = profile.role === "policy_analyst";
  const btnColor = isAnalyst
    ? "bg-blue-600 hover:bg-blue-700"
    : "bg-emerald-600 hover:bg-emerald-700";
  const focusClass = isAnalyst
    ? "focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/40"
    : "focus:border-emerald-500 focus:ring-emerald-100 dark:focus:ring-emerald-900/40";
  const accentLightBg = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";
  const accentBorder = isAnalyst
    ? "border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
    : "border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30";
  const accentIconText = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";

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
        "Password changed successfully. Your next login will use the new password."
      );
      setCurrent("");
      setNewPw("");
      setConfirm("");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 400) {
        setError(
          typeof detail === "string" ? detail : "Current password is incorrect."
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
            className={cn(
              "w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 pr-10 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all",
              focusClass
            )}
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
    [focusClass]
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
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm",
              btnColor
            )}
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

      {/* Device Synchronization */}
      <SectionCard
        title="Device Synchronization"
        description="Manage active authenticated devices and sync secure login sessions."
        action={
          <button
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 disabled:cursor-not-allowed",
              isAnalyst
                ? "text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                : "text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            )}
          >
            {sessionsLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      >
        <div className="space-y-5">
          {Capacitor.isNativePlatform() && (
            <button
              onClick={handleQRClick}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] group",
                accentLightBg,
                accentBorder
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <QrCode className={accentIconText} size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                    Sync to Web Browser
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                    Scan QR from the institutional login page
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className={accentIconText} />
            </button>
          )}

          {/* Active Sessions List */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Active Sessions
              </h4>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  isAnalyst
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/40"
                    : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/40"
                )}
              >
                {sessions.length} / 3 Devices
              </span>
            </div>

            {sessionsLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2
                  className={cn("animate-spin", accentIconText)}
                  size={20}
                />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-zinc-500 py-2">
                No active device sessions found.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((s) => (
                  <div
                    key={s.jti}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800/85 bg-gray-50/50 dark:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 flex-shrink-0">
                        {s.device_type === "Mobile" ? (
                          <Smartphone size={16} />
                        ) : s.platform === "Windows" ||
                          s.platform === "macOS" ||
                          s.platform === "Linux" ? (
                          <Laptop size={16} />
                        ) : (
                          <Monitor size={16} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5 flex-wrap">
                          {s.device_name}
                          {s.is_current && (
                            <span className="text-[9px] font-bold bg-green-500/10 text-green-500 dark:text-green-400 px-1.5 py-0.5 rounded-md">
                              Current
                            </span>
                          )}
                          {s.is_primary && (
                            <span className="text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                          {s.is_current
                            ? "Active now"
                            : `Last active: ${formatTime(s.last_active_at)}`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setRevokeTarget(s)}
                      title="Sign out device"
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <PermissionOnboarding
        portalType="institutional"
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onGranted={() => {
          setIsPermissionModalOpen(false);
          setIsScannerOpen(true);
        }}
      />

      {isScannerOpen && (
        <QRScanner
          portalType="institutional"
          onClose={() => {
            setIsScannerOpen(false);
            fetchSessions();
          }}
        />
      )}

      <SessionRevokeModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={async () => {
          await handleRevokeSession(revokeTarget);
        }}
        session={revokeTarget}
        portalType="institutional"
      />

      {/* Session info */}
      <SectionCard
        title="Activity Logs"
        description="Audit trail of your recent activity on the portal."
      >
        <div className="space-y-3">
          {[
            {
              label: "Account Registered",
              value: formatDateTime(profile.created_at),
              sub: `${Math.floor(
                (Date.now() - new Date(profile.created_at).getTime()) / 86400000
              )} days ago`,
              icon: <Calendar size={13} className={profile.role === "policy_analyst" ? "text-blue-500" : "text-emerald-500"} />,
            },
            {
              label: "Last Credential Sync",
              value: formatDateTime(profile.updated_at),
              sub: timeAgo(profile.updated_at),
              icon: <User size={13} className={profile.role === "policy_analyst" ? "text-blue-500" : "text-emerald-500"} />,
            },
            {
              label: "Last Authorised Login",
              value: formatDateTime(profile.last_login_at),
              sub: timeAgo(profile.last_login_at),
              icon: <Clock size={13} className={profile.role === "policy_analyst" ? "text-blue-500" : "text-emerald-500"} />,
            },
          ].map(({ label, value, sub, icon }) => (
            <div
              key={label}
              className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                    isAnalyst
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "bg-emerald-50 dark:bg-emerald-900/20"
                  )}
                >
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

function AppearanceSection({ isAnalyst }: { isAnalyst: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activeBorder = isAnalyst
    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700"
    : "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700";
  const activeIconBg = isAnalyst
    ? "bg-blue-100 dark:bg-blue-900/40"
    : "bg-emerald-100 dark:bg-emerald-900/40";
  const activeText = isAnalyst
    ? "text-blue-700 dark:text-blue-300"
    : "text-emerald-700 dark:text-emerald-300";
  const activeCheck = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";
  const hoverClass = isAnalyst
    ? "hover:border-blue-200 dark:hover:border-blue-900"
    : "hover:border-emerald-200 dark:hover:border-emerald-900";

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Portal Theme"
        description="Choose your preferred display mode for the institutional interface."
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
                sub: isAnalyst
                  ? "Blue low-light theme"
                  : "Emerald low-light theme",
                icon: (
                  <Moon
                    size={20}
                    className={isAnalyst ? "text-blue-400" : "text-emerald-400"}
                  />
                ),
              },
            ] as const
          ).map(({ value, label, sub, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`text-left flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                theme === value
                  ? activeBorder
                  : `border-gray-200 bg-gray-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 ${hoverClass}`
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  theme === value
                    ? activeIconBg
                    : "bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 shadow-sm"
                }`}
              >
                {icon}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    theme === value
                      ? activeText
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
                  className={`${activeCheck} ml-auto flex-shrink-0`}
                />
              )}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

interface ChatListItem {
  id: number;
  title: string;
  preview: string;
  updated_at: string;
  user_message_count: number;
  ai_response_count: number;
  at_capacity: boolean;
}

function ChatHistorySection({
  portalType,
  variant = "emerald",
  refreshTrigger = 0,
  onLoadingChange,
}: {
  portalType: "sme" | "institutional" | "sme_docs" | "regulator_docs" | "analyst_docs";
  variant?: "purple" | "emerald" | "blue";
  refreshTrigger?: number;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [conversations, setConversations] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const router = useRouter();

  const isSme = portalType === "sme" || portalType === "sme_docs";
  const accentText =
    variant === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : variant === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-purple-600 dark:text-purple-400";

  const getRequestHeaders = useCallback(() => {
    if (isSme) return {};
    const t = localStorage.getItem("inst_token");
    return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
  }, [isSme]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      const res = await api.get<ChatListItem[]>(
        `/api/conversations/?portal_type=${portalType}`,
        getRequestHeaders()
      );
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      setError("Failed to load history.");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [portalType, getRequestHeaders, onLoadingChange]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshTrigger]);

  const handleLoad = (id: number) => {
    const isDocs = portalType.endsWith("_docs");
    if (isDocs) {
      localStorage.setItem(
        "load_docs_conversation",
        JSON.stringify({
          conversationId: id,
          portalType,
        })
      );
      let targetPath = "/sme/docs";
      if (portalType === "regulator_docs") {
        targetPath = "/regulator/docs";
      } else if (portalType === "analyst_docs") {
        targetPath = "/analyst/docs";
      }
      router.push(targetPath);
    } else {
      localStorage.setItem(
        "load_conversation",
        JSON.stringify({
          conversationId: id,
          portalType,
        })
      );
      window.dispatchEvent(
        new CustomEvent("load-conversation", {
          detail: { conversationId: id, portalType },
        })
      );
    }
  };

  const handleStartRename = (id: number, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = async (id: number) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await api.put(
        `/api/conversations/${id}`,
        { title: editTitle.trim() },
        getRequestHeaders()
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: res.data.title } : c))
      );
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/conversations/${id}`, getRequestHeaders());
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await api.delete(
        `/api/conversations/?portal_type=${portalType}`,
        getRequestHeaders()
      );
      setConversations([]);
    } catch (err) {
      console.error("Failed to delete all conversations:", err);
    } finally {
      setConfirmDeleteAll(false);
    }
  };

  const isDocs = portalType.endsWith("_docs");
  const innerTitle = isDocs ? "Docs AI" : "FinWatch AI";

  const cardBg =
    variant === "blue"
      ? "bg-blue-50/20 hover:bg-blue-50/50 active:bg-blue-100/40 dark:bg-blue-950/5 dark:hover:bg-blue-950/15 dark:active:bg-blue-950/25 border-blue-100/10 dark:border-blue-900/5"
      : variant === "emerald"
      ? "bg-emerald-50/20 hover:bg-emerald-50/50 active:bg-emerald-100/40 dark:bg-emerald-950/5 dark:hover:bg-emerald-950/15 dark:active:bg-emerald-950/25 border-emerald-100/10 dark:border-emerald-900/5"
      : "bg-purple-50/20 hover:bg-purple-50/50 active:bg-purple-100/40 dark:bg-purple-950/5 dark:hover:bg-purple-950/15 dark:active:bg-purple-950/25 border-purple-100/10 dark:border-purple-900/5";

  return (
    <div className="bg-gray-50/30 dark:bg-zinc-900/10 border border-gray-100 dark:border-zinc-800/80 rounded-2xl p-5 flex flex-col space-y-4 shadow-sm">
      {/* Inner Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800/50">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
            {innerTitle}
          </h3>
        </div>
        {conversations.length > 0 && (
          <div className="flex items-center">
            {confirmDeleteAll ? (
              <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/30 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Clear all?</span>
                <button
                  onClick={handleDeleteAll}
                  className="p-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="p-1 rounded-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Delete all chats"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
          <Loader2 size={24} className={cn("animate-spin", accentText)} />
          <span className="text-sm italic">Loading history...</span>
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-red-500 font-medium">
          {error}
        </div>
      ) : conversations.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500 font-medium italic">
          {isSme
            ? "No saved conversations yet. Start a chat to begin."
            : "No saved conversations yet."}
        </div>
      ) : (
        <div className="max-h-[225px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-gray-100 dark:scrollbar-thumb-zinc-900">
          {conversations.map((conv) => {
            const isDeleting = deletingId === conv.id;
            const isEditing = editingId === conv.id;

            return (
              <div
                key={conv.id}
                onClick={() => !isEditing && handleLoad(conv.id)}
                className={cn(
                  "flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden relative",
                  cardBg
                )}
              >
                {/* Row 1: Header */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left side: Timestamp + Title/Rename Input */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {!isEditing && (
                      <>
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 whitespace-nowrap font-medium flex-shrink-0">
                          {timeAgo(conv.updated_at)}
                        </span>
                        <span className="text-gray-200 dark:text-zinc-800 font-light flex-shrink-0">|</span>
                      </>
                    )}
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveRename(conv.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRename(conv.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "w-full text-xs font-semibold text-gray-900 dark:text-white bg-white dark:bg-zinc-800 border rounded px-2 py-1 focus:outline-none focus:ring-1 transition-all",
                            variant === "blue"
                              ? "border-blue-400 focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                              : "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 dark:focus:ring-emerald-900/40"
                          )}
                        />
                      ) : (
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                          {conv.title || "Untitled Chat"}
                        </h4>
                      )}
                    </div>
                  </div>

                  {/* Right side: standard actions when NOT renaming */}
                  {!isEditing && (
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleStartRename(conv.id, conv.title)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800/80 transition-colors shadow-sm border border-gray-100 dark:border-zinc-800"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingId(conv.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shadow-sm border border-gray-100 dark:border-zinc-800"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 2: Message preview */}
                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                  {stripMarkdown(conv.preview) || "No preview available"}
                </p>

                {/* Confirm Delete overlay */}
                {isDeleting && (
                  <div 
                    className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 flex items-center justify-center gap-4 animate-in fade-in duration-200 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-red-500 font-bold uppercase">Delete this chat?</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(conv.id)}
                        className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}

                {/* Row 3: Helper text during Rename Mode (Hidden on mobile to prevent expansion) */}
                {isEditing && (
                  <div className="mt-1 pt-2 border-t border-gray-100/50 dark:border-zinc-800/50 hidden sm:flex justify-end">
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 italic">Press Enter to save</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountSection({ profile }: { profile: UserProfile }) {
  const isAnalyst = profile.role === "policy_analyst";
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const isRefreshing = loadingMain || loadingDocs;

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

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
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
                {label}
              </p>
              <p
                className={`text-sm text-gray-800 dark:text-zinc-100 ${
                  mono ? "font-mono" : "font-medium"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div id="chat-history-section">
        <SectionCard
          title="AI Chat History"
          description="Manage your stored AI chat threads."
          action={
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50 flex items-center justify-center shadow-sm"
              title="Refresh Chat History"
            >
              <RefreshCw size={14} className={cn("transition-transform", isRefreshing && "animate-spin")} />
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChatHistorySection
              portalType="institutional"
              variant={isAnalyst ? "blue" : "emerald"}
              refreshTrigger={refreshTrigger}
              onLoadingChange={setLoadingMain}
            />
            <ChatHistorySection
              portalType={isAnalyst ? "analyst_docs" : "regulator_docs"}
              variant={isAnalyst ? "blue" : "emerald"}
              refreshTrigger={refreshTrigger}
              onLoadingChange={setLoadingDocs}
            />
          </div>
        </SectionCard>
      </div>

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
              body: isAnalyst
                ? "Policy Analysts have read-only access to aggregate metrics. You can generate strategic reports with automated anomaly suppression."
                : "Policy Analysts have read-only access to aggregate metrics. Only Regulators can access anonymised high-risk flags and full data exports.",
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

function DangerSection({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteAccount = async () => {
    if (profile) {
      localStorage.removeItem(
        `hasSeenWelcomeModal_${profile.id || profile.email}`
      );
    }
    sessionStorage.removeItem("hasSeenAITooltipThisSession");

    await api.delete("/api/auth/me");
    await clearInstitutionalToken();
    router.replace("/institutional/auth/login");
  };

  return (
    <div className="space-y-4">
      {/* Account deletion */}
      <div className="bg-red-50/50 dark:bg-red-900/10 backdrop-blur-xl border border-red-200 dark:border-red-800 rounded-2xl p-6 space-y-4 shadow-sm dark:shadow-none shadow-red-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={18}
            className="text-red-500 flex-shrink-0 mt-0.5"
          />
          <div>
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Delete Account
            </h2>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
              Permanently removes your institutional account and all associated
              portal access. This action is irreversible.
            </p>
          </div>
        </div>

        <div className="pl-7">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/10 transition-all active:scale-[0.98]"
          >
            Delete Account
          </button>
        </div>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

// Component

function InstitutionalSettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileSectionActive, setMobileSectionActive] = useState(false);

  // Handle deep linking to tabs
  useEffect(() => {
    const tab = searchParams.get("tab") as TabKey;
    if (tab && TABS.some((t) => t.key === tab)) {
      setActiveTab(tab);
      if (window.innerWidth < 1024) {
        setMobileSectionActive(true);
      }
    }
  }, [searchParams]);

  // Scroll to chat history section when navigating from the AI assistant
  useEffect(() => {
    if (searchParams.get("section") !== "chat-history") return;
    if (activeTab !== "account" || !profile) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById("chat-history-section");
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab, profile, searchParams]);

  useEffect(() => {
    api
      .get<UserProfile>("/api/auth/me")
      .then((r) => setProfile(r.data))
      .catch(() => setError("Failed to load profile. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const isAnalyst = profile?.role === "policy_analyst";
  const loaderColor = isAnalyst ? "text-blue-600" : "text-emerald-400";
  const activeTabBg = isAnalyst
    ? "bg-blue-100/80 dark:bg-blue-900/40"
    : "bg-emerald-100/80 dark:bg-emerald-900/40";
  const activeTabText = isAnalyst
    ? "text-blue-800 dark:text-blue-200"
    : "text-emerald-800 dark:text-emerald-200";
  const accentColor = isAnalyst
    ? "text-blue-600 dark:text-blue-400"
    : "text-emerald-600 dark:text-emerald-400";
  const accentBg = isAnalyst
    ? "bg-blue-50 dark:bg-blue-900/20"
    : "bg-emerald-50 dark:bg-emerald-900/20";

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label;

  return (
    <div className="px-6 pb-20 max-w-screen-2xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3 mt-2">
        {mobileSectionActive && (
          <button
            onClick={() => setMobileSectionActive(false)}
            className="lg:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft
              size={20}
              className="text-gray-600 dark:text-zinc-400"
            />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              accentBg
            )}
          >
            <Settings size={20} className={accentColor} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              Settings
              {mobileSectionActive && (
                <>
                  <span className="text-gray-300 dark:text-zinc-700 font-light">
                    /
                  </span>
                  <span className={accentColor}>{activeLabel}</span>
                </>
              )}
            </h1>
            {!mobileSectionActive && (
              <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
                {isAnalyst
                  ? "Manage your portal access, security, and strategic analyst profile."
                  : "Manage your portal access, security, and institutional profile."}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className={cn("animate-spin", loaderColor)} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <AlertTriangle size={28} className="text-red-300" />
          <p className="text-sm text-gray-400 dark:text-zinc-500">{error}</p>
        </div>
      ) : (
        profile && (
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sidebar nav / Options List */}
            <nav
              className={cn(
                "lg:w-64 flex-shrink-0 lg:sticky lg:top-6 lg:self-start",
                mobileSectionActive ? "hidden lg:block" : "block"
              )}
            >
              <div className="flex flex-col gap-1.5 w-full">
                {TABS.map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveTab(key);
                      setMobileSectionActive(true);
                    }}
                    className={cn(
                      "flex items-center justify-between px-4 py-4 lg:py-3.5 rounded-2xl lg:rounded-xl text-sm font-medium transition-all w-full text-left border border-transparent active:scale-[0.98]",
                      // Base styling (Mobile default for all)
                      "text-gray-600 bg-white border-gray-50 hover:bg-gray-100",
                      // Mobile Dark Mode Accent (Solid, no glassmorphism)
                      isAnalyst
                        ? "dark:bg-[#0a142d] dark:border-blue-900/40 dark:text-blue-300 dark:hover:bg-[#0e1b3d]"
                        : "dark:bg-[#061811] dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-[#092218]",
                      // Reset for Desktop (where it should be transparent unless active)
                      "lg:bg-transparent lg:dark:bg-transparent lg:border-transparent lg:dark:border-transparent lg:text-zinc-400 lg:dark:text-zinc-400",
                      // Persistent Active State (Desktop Only)
                      activeTab === key &&
                        (key === "danger"
                          ? "lg:bg-red-50 lg:dark:bg-red-900/20 lg:text-red-700 lg:dark:text-red-400 lg:border-red-100 lg:dark:border-red-900/30 lg:shadow-sm"
                          : isAnalyst
                          ? "lg:bg-blue-100/80 lg:dark:bg-blue-900/40 lg:text-blue-800 lg:dark:text-blue-200 lg:shadow-sm"
                          : "lg:bg-emerald-100/80 lg:dark:bg-emerald-900/40 lg:text-emerald-800 lg:dark:text-emerald-200 lg:shadow-sm"),
                      // Tap feedback (Mobile highlight)
                      key === "danger"
                        ? "active:bg-red-100/80 active:dark:bg-red-900/40 active:text-red-700"
                        : isAnalyst
                        ? "active:bg-blue-100/80 active:dark:bg-blue-900/40 active:text-blue-800"
                        : "active:bg-emerald-100/80 active:dark:bg-emerald-900/40 active:text-emerald-800",
                      // Danger specific (even when not active)
                      key === "danger" &&
                        "text-red-600 dark:text-red-400 dark:bg-[#1a0a0a] dark:border-red-900/40"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg lg:p-0 transition-colors bg-gray-50 lg:bg-transparent lg:dark:bg-transparent",
                          isAnalyst
                            ? "dark:bg-blue-900/30"
                            : "dark:bg-emerald-900/30",
                          key === "danger" && "dark:bg-red-900/30"
                        )}
                      >
                        {icon}
                      </div>
                      <span className="lg:text-sm tracking-tight">{label}</span>
                    </div>
                    <ChevronRight
                      size={14}
                      className="lg:hidden text-gray-300"
                    />
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            <div
              className={cn(
                "flex-1 min-w-0 space-y-4 max-w-full",
                !mobileSectionActive ? "hidden lg:block" : "block"
              )}
            >
              {activeTab === "profile" && (
                <ProfileSection profile={profile} onUpdated={setProfile} />
              )}
              {activeTab === "security" && (
                <SecuritySection profile={profile} />
              )}
              {activeTab === "appearance" && (
                <AppearanceSection isAnalyst={isAnalyst} />
              )}
              {activeTab === "account" && <AccountSection profile={profile} />}
              {activeTab === "danger" && <DangerSection profile={profile} />}
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function InstitutionalSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 size={32} className="animate-spin text-emerald-400" />
      </div>
    }>
      <InstitutionalSettingsContent />
    </Suspense>
  );
}
