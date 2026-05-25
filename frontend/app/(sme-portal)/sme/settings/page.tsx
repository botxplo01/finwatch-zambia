"use client";

/**
 * FinWatch Zambia - SME Settings
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
  Mail,
  Calendar,
  Clock,
  BadgeCheck,
  Save,
  LogOut,
  Camera,
  Trash2,
  Move,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import api from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { DeleteAccountModal } from "@/components/shared/DeleteAccountModal";
import { cn, isTitleInName } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ImageCropperModal } from "@/components/shared/ImageCropperModal";

// Types

interface UserProfile {
  id: number;
  full_name: string;
  title?: string | null;
  email: string;
  role: string;
  business_scale?: "small_scale" | "medium_scale" | null;
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
      className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-none">
      <div className="border-b border-gray-50 dark:border-white/5 pb-4">
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
  { key: "profile", label: "Profile", icon: <User size={18} /> },
  { key: "security", label: "Security", icon: <Lock size={18} /> },
  { key: "appearance", label: "Appearance", icon: <Palette size={18} /> },
  { key: "account", label: "Account", icon: <Info size={18} /> },
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
  const [businessScale, setBusinessScale] = useState(profile.business_scale || "medium_scale");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsExtracting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty =
    fullName !== profile.full_name ||
    email !== profile.email ||
    businessScale !== profile.business_scale;

  const handleSave = useCallback(async () => {
    if (!fullName.trim()) {
      setError("Full name cannot be empty.");
      return;
    }

    const titleFound = isTitleInName(fullName);
    if (titleFound) {
      setError(`Full name should not include professional titles like '${titleFound}'. Please use the Title set during registration.`);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.put<UserProfile>("/api/auth/me", {
        full_name: fullName.trim(),
        email: email.trim(),
        business_scale: businessScale,
      });
      onUpdated(res.data);
      // Update cached user
      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("profile-updated"));
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
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      onUpdated(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      window.dispatchEvent(new Event("profile-updated"));
      toast({
        title: "Profile updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Could not update your profile picture. Please try again.",
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
      localStorage.setItem("user", JSON.stringify(res.data));
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
    ? (profile.profile_picture_url.startsWith("http") 
        ? profile.profile_picture_url 
        : `${process.env.NEXT_PUBLIC_API_URL || "https://finwatch-backend.onrender.com"}${profile.profile_picture_url}`)
    : null;

  const originalImageUrl = profile.original_profile_picture_url
    ? (profile.original_profile_picture_url.startsWith("http")
        ? profile.original_profile_picture_url
        : `${process.env.NEXT_PUBLIC_API_URL || "https://finwatch-backend.onrender.com"}${profile.original_profile_picture_url}`)
    : profileImageUrl;

  return (
    <div className="space-y-4">
      {/* Profile Picture Card */}
      <SectionCard
        title="Profile Picture"
        description="Choose a professional photo to represent your account across the portal."
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-gray-100 dark:border-zinc-800 shadow-md">
              {profileImageUrl && <AvatarImage src={profileImageUrl} alt={profile.full_name} />}
              <AvatarFallback className="bg-purple-50 dark:bg-purple-900/20 text-xl text-purple-600 dark:text-purple-300">
                {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : initials}
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
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/10 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Camera size={14} />
                {profile.profile_picture_url ? "Change" : "Upload Photo"}
              </button>

              {profile.profile_picture_url && (
                <>
                  <button
                    onClick={() => setSelectedImage(originalImageUrl)}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-purple-100 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
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
              JPG, PNG or SVG. Max size 2MB.
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
          portal="sme"
        />
      )}

      <SectionCard
        title="Personal Information"
        description="Update your display name and email address."
      >
        <FieldGroup label="Full Name">
          <TextInput
            value={fullName}
            onChange={setFullName}
            placeholder="Your full name"
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
            placeholder="your@email.com"
          />
        </FieldGroup>

        <FieldGroup
          label="Business Scale"
          hint="Determines whether you see simplified plain-language guidance or technical financial analysis."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: "small_scale", label: "Growing Business", desc: "Simple questions" },
              { id: "medium_scale", label: "Established Business", desc: "Detailed ratios" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setBusinessScale(s.id as any)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-xl border transition-all text-left",
                  businessScale === s.id
                    ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 ring-1 ring-purple-500"
                    : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-purple-200 dark:hover:border-purple-800"
                )}
              >
                <span className={cn(
                  "text-xs font-bold",
                  businessScale === s.id ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-zinc-300"
                )}>
                  {s.label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">{s.desc}</span>
              </button>
            ))}
          </div>
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
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
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
        title="Identity"
        description="These values are system-assigned and cannot be changed."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              label: "User ID",
              value: `#${profile.id}`,
              icon: <BadgeCheck size={13} className="text-purple-500" />,
            },
            {
              label: "Account Role",
              value: profile.is_admin ? "Administrator" : "SME Owner",
              icon: <Shield size={13} className="text-purple-500" />,
            },
            {
              label: "Account Status",
              value: profile.is_active ? "Active" : "Inactive",
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
              icon: <Calendar size={13} className="text-purple-500" />,
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

  // Password strength - memoized to prevent re-renders
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

  // Sub-component for individual password inputs - prevents re-renders of the whole section
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
            className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-xl px-3.5 py-2.5 pr-10 text-sm placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 transition-all"
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
        title="Change Password"
        description="Use a strong, unique password. Minimum 8 characters."
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
          {/* Strength indicator */}
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
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            style={{ background: "linear-gradient(135deg, #6d28d9, #4c1d95)" }}
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
        title="Session & Login Activity"
        description="Overview of recent account activity."
      >
        <div className="space-y-3">
          {[
            {
              label: "Last Login",
              value: formatDateTime(profile.last_login_at),
              sub: timeAgo(profile.last_login_at),
              icon: <Clock size={13} className="text-purple-500" />,
            },
            {
              label: "Account Created",
              value: formatDateTime(profile.created_at),
              sub: `${Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)} days ago`,
              icon: <Calendar size={13} className="text-purple-500" />,
            },
            {
              label: "Last Profile Update",
              value: formatDateTime(profile.updated_at),
              sub: timeAgo(profile.updated_at),
              icon: <User size={13} className="text-purple-500" />,
            },
          ].map(({ label, value, sub, icon }) => (
            <div
              key={label}
              className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
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

      {/* Security tips */}
      <SectionCard title="Security Recommendations">
        <ul className="space-y-2.5">
          {[
            "Use a password manager to generate and store strong passwords.",
            "Never share your FinWatch credentials with anyone.",
            "Log out of shared or public devices after each session.",
            "If you suspect unauthorised access, change your password immediately.",
          ].map((tip) => (
            <li
              key={tip}
              className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-zinc-300"
            >
              <CheckCircle2
                size={13}
                className="text-purple-500 flex-shrink-0 mt-0.5"
              />
              {tip}
            </li>
          ))}
        </ul>
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
        title="Theme"
        description="Choose how FinWatch looks. Your preference is saved across sessions."
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
                sub: "Easy on the eyes",
                icon: <Moon size={20} className="text-blue-400" />,
              },
            ] as const
          ).map(({ value, label, sub, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`text-left flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                theme === value
                  ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-700"
                  : "border-gray-200 bg-gray-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 hover:border-purple-200 dark:hover:border-purple-900"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  theme === value
                    ? "bg-purple-100 dark:bg-purple-900/40"
                    : "bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 shadow-sm"
                }`}
              >
                {icon}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    theme === value
                      ? "text-purple-700 dark:text-purple-300"
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
                  className="text-purple-600 dark:text-purple-400 ml-auto flex-shrink-0"
                />
              )}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Typography"
        description="FinWatch uses Geist Sans for all UI text and Geist Mono for numeric and code contexts."
      >
        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide font-medium mb-0.5">
                UI Font
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                Geist Sans
              </p>
            </div>
            <p
              className="text-base text-gray-600 dark:text-zinc-300"
              style={{ fontFamily: "var(--font-geist-sans)" }}
            >
              Aa Bb Cc
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide font-medium mb-0.5">
                Mono Font
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                Geist Mono
              </p>
            </div>
            <p className="text-base text-gray-600 dark:text-zinc-300 font-mono">
              0.123
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Font settings are fixed to maintain consistency with the FinWatch
          design system.
        </p>
      </SectionCard>
    </div>
  );
}

function AccountSection({ profile }: { profile: UserProfile }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Account Overview"
        description="A full summary of your FinWatch account."
      >
        <div className="space-y-0 divide-y divide-gray-50 dark:divide-zinc-800">
          {[
            { label: "User ID", value: `#${profile.id}`, mono: true },
            { label: "Full Name", value: profile.full_name, mono: false },
            { label: "Email Address", value: profile.email, mono: false },
            {
              label: "Role",
              value: profile.is_admin ? "Administrator" : "SME Owner",
              mono: false,
            },
            {
              label: "Status",
              value: profile.is_active ? "Active" : "Inactive",
              mono: false,
            },
            {
              label: "Account Created",
              value: formatDateTime(profile.created_at),
              mono: true,
            },
            {
              label: "Last Updated",
              value: formatDateTime(profile.updated_at),
              mono: true,
            },
            {
              label: "Last Login",
              value: formatDateTime(profile.last_login_at),
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
        title="Data & Privacy"
        description="How FinWatch handles your data."
      >
        <ul className="space-y-3">
          {[
            {
              heading: "Your financial data stays private",
              body: "All financial records, predictions, and reports are linked to your account only. No other user can access your data.",
            },
            {
              heading: "ML models are shared, data is not",
              body: "The machine learning models are trained on the UCI Polish Companies Bankruptcy dataset — not your personal records. Your data is never used for training.",
            },
            {
              heading: "Local storage",
              body: "FinWatch stores your data on a local SQLite database on the server. No data is sent to third-party analytics platforms.",
            },
            {
              heading: "NLP narratives via Groq",
              body: "When a narrative is generated, ratio values and SHAP attributions are sent to Groq's API. No personally identifiable information is included in these requests.",
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
      localStorage.removeItem(`hasSeenWelcomeModal_${profile.id || profile.email}`);
    }
    sessionStorage.removeItem("hasSeenAITooltipThisSession");
    
    await api.delete("/api/auth/me");
    clearToken();
    router.replace(\"/sme/auth/login\");
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
              Permanently removes your account and all associated data. This action is irreversible.
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

// Page

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileSectionActive, setMobileSectionActive] = useState(false);

  useEffect(() => {
    api
      .get<UserProfile>("/api/auth/me")
      .then((r) => setProfile(r.data))
      .catch(() => setError("Failed to load profile. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

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
            <ChevronLeft size={20} className="text-gray-600 dark:text-zinc-400" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
            <Settings size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              Settings
              {mobileSectionActive && (
                <>
                  <span className="text-gray-300 dark:text-zinc-700 font-light">/</span>
                  <span className="text-purple-600 dark:text-purple-400">{activeLabel}</span>
                </>
              )}
            </h1>
            {!mobileSectionActive && (
              <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
                Manage your profile, security, and account preferences.
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-purple-400" />
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
            <nav className={cn(
              "lg:w-64 flex-shrink-0 lg:sticky lg:top-6 lg:self-start",
              mobileSectionActive ? "hidden lg:block" : "block"
            )}>
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
                      "dark:bg-[#160a2d] dark:border-purple-900/40 dark:text-purple-300 dark:hover:bg-[#1c0d3a]",
                      // Reset for Desktop (where it should be transparent unless active)
                      "lg:bg-transparent lg:dark:bg-transparent lg:border-transparent lg:dark:border-transparent lg:text-zinc-400 lg:dark:text-zinc-400",
                      // Persistent Active State (Desktop Only)
                      activeTab === key && (
                        key === "danger"
                          ? "lg:bg-red-50 lg:dark:bg-red-900/20 lg:text-red-700 lg:dark:text-red-400 lg:border-red-100 lg:dark:border-red-900/30 lg:shadow-sm"
                          : "lg:bg-purple-100/80 lg:dark:bg-purple-900/40 lg:text-purple-800 lg:dark:text-purple-200 lg:shadow-sm"
                      ),
                      // Tap feedback (Mobile highlight)
                      key === "danger"
                        ? "active:bg-red-100/80 active:dark:bg-red-900/40 active:text-red-700"
                        : "active:bg-purple-100/80 active:dark:bg-purple-900/40 active:text-purple-800",
                      // Danger specific (even when not active)
                      key === "danger" && "text-red-600 dark:text-red-400 dark:bg-[#1a0a0a] dark:border-red-900/40"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-lg lg:p-0 transition-colors bg-gray-50 dark:bg-purple-900/30 lg:bg-transparent lg:dark:bg-transparent",
                        key === "danger" && "dark:bg-red-900/30"
                      )}>
                        {icon}
                      </div>
                      <span className="lg:text-sm tracking-tight">{label}</span>
                    </div>
                    <ChevronRight size={14} className="lg:hidden text-gray-300" />
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            <div className={cn(
              "flex-1 min-w-0 space-y-4 max-w-full",
              !mobileSectionActive ? "hidden lg:block" : "block"
            )}>
              {activeTab === "profile" && (
                <ProfileSection profile={profile} onUpdated={setProfile} />
              )}
              {activeTab === "security" && (
                <SecuritySection profile={profile} />
              )}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "account" && <AccountSection profile={profile} />}
              {activeTab === "danger" && <DangerSection profile={profile} />}
            </div>
          </div>
        )
      )}
    </div>
  );
}
