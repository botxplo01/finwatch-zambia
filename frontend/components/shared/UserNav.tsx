"use client";

/**
 * FinWatch Zambia - User Navigation Component
 *
 * Compact user profile section for the sidebar footer with initials/avatar fallback,
 * bold names, and a vertical 3-dots dropdown for Settings and Sign Out.
 * Matches shadcn/ui Dashboard interaction pattern.
 */

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  MoreVertical,
  Settings,
  LogOut,
  User,
  Camera,
  Trash2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { clearRegToken } from "@/lib/regulator-auth";
import { cn, formatProfessionalName } from "@/lib/utils";

interface UserProfile {
  id: number;
  full_name: string;
  title?: string | null;
  email: string;
  role: string;
  profile_picture_url?: string | null;
}

interface UserNavProps {
  collapsed?: boolean;
  portal: "sme" | "regulator";
  userProfile?: UserProfile | null;
}

export function UserNav({ collapsed, portal, userProfile }: UserNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(
    userProfile || null
  );

  const settingsHref =
    portal === "regulator" ? "/institutional/settings" : "/sme/settings";
  const isSettingsActive = pathname === settingsHref;

  // Sync with prop if it changes
  useEffect(() => {
    if (userProfile) setProfile(userProfile);
  }, [userProfile]);

  // Fetch profile if not provided
  useEffect(() => {
    const fetchProfile = () => {
      api
        .get<UserProfile>("/api/auth/me")
        .then((res) => {
          setProfile(res.data);
          // Also update local cache for responsiveness
          if (portal === "regulator") {
            localStorage.setItem("reg_user", JSON.stringify(res.data));
          } else {
            localStorage.setItem("user", JSON.stringify(res.data));
          }
        })
        .catch(() => console.warn("Failed to fetch user profile for UserNav"));
    };

    if (!profile) {
      fetchProfile();
    }

    // Listen for updates from other components (like Settings page)
    window.addEventListener("profile-updated", fetchProfile);
    return () => window.removeEventListener("profile-updated", fetchProfile);
  }, [profile, portal]);

  const handleSignOut = async () => {
    if (portal === "regulator") {
      await clearRegToken();
      router.replace("/institutional/auth/login");
    } else {
      await clearToken();
      router.replace("/sme/auth/login");
    }
  };

  if (!profile) return null;

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

  // Theme Config
  const isAnalyst = profile.role === "policy_analyst";
  const activeBg = isAnalyst ? "bg-blue-900/40" : "bg-emerald-900/40";
  const activeText = isAnalyst ? "text-blue-400" : "text-emerald-400";

  const accentBg =
    portal === "regulator"
      ? isAnalyst
        ? "bg-blue-500/20"
        : "bg-emerald-500/20"
      : "bg-purple-50 dark:bg-purple-900/20";

  // Force dark text/hover colors for the regulator portal because its sidebar is always dark
  const containerClasses =
    portal === "regulator"
      ? cn(
          "group w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 outline-none",
          isSettingsActive ? activeBg : "hover:bg-white/10"
        )
      : cn(
          "group w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 outline-none",
          isSettingsActive
            ? "bg-zinc-100 dark:bg-purple-900/20 shadow-sm"
            : "hover:bg-gray-50 dark:hover:bg-zinc-800"
        );

  const nameClasses =
    portal === "regulator"
      ? cn(
          "text-sm font-bold truncate leading-none mb-1",
          isSettingsActive ? activeText : "text-white"
        )
      : cn(
          "text-sm font-bold truncate leading-none mb-1",
          isSettingsActive
            ? "text-zinc-900 dark:text-purple-300"
            : "text-gray-900 dark:text-zinc-100"
        );

  const emailClasses =
    portal === "regulator"
      ? "text-[11px] text-zinc-400 truncate leading-none"
      : "text-[11px] text-gray-500 dark:text-zinc-500 truncate leading-none";

  return (
    <div
      className={cn(
        "mt-auto border-t p-3",
        portal === "regulator"
          ? "border-white/10"
          : "border-gray-100 dark:border-zinc-800"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            id="nav-user-profile"
            className={cn(
              "relative",
              containerClasses,
              collapsed ? "justify-center px-0" : "px-3"
            )}
            aria-label="User menu"
          >
            <Avatar
              className={cn(
                "h-9 w-9 border",
                portal === "regulator"
                  ? "border-white/10"
                  : "border-gray-100 dark:border-zinc-700"
              )}
            >
              {profileImageUrl && (
                <AvatarImage src={profileImageUrl} alt={profile.full_name} />
              )}
              <AvatarFallback className={accentBg}>{initials}</AvatarFallback>
            </Avatar>

            {!collapsed && (
              <>
                <div className="flex-1 text-left min-w-0 ml-1">
                  <p className={nameClasses}>
                    {formatProfessionalName(profile.full_name, profile.title)}
                  </p>
                  <p className={emailClasses}>{profile.email}</p>
                </div>
                <MoreVertical
                  size={16}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isSettingsActive
                      ? portal === "regulator"
                        ? activeText
                        : "text-zinc-900 dark:text-purple-300"
                      : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-zinc-300"
                  )}
                />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="right"
          align="end"
          sideOffset={14}
          alignOffset={4}
          className={cn(
            "w-56 animate-in slide-in-from-left-2 duration-200",
            portal === "regulator"
              ? (isAnalyst
                  ? "bg-[#050b1a]/95 border-blue-900/30"
                  : "bg-[#020d0a]/95 border-emerald-900/30") +
                  " backdrop-blur-xl text-white shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              : "dark:bg-zinc-800 dark:border-zinc-700 shadow-xl"
          )}
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                portal === "regulator"
                  ? "text-zinc-500"
                  : "text-gray-400 dark:text-zinc-500"
              )}
            >
              Signed in as
            </span>
            <span className="text-sm font-bold truncate">
              {formatProfessionalName(profile.full_name, profile.title, 24)}
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator
            className={
              portal === "regulator" ? "bg-white/5" : "dark:bg-zinc-700"
            }
          />

          <DropdownMenuItem asChild>
            <Link
              href={settingsHref}
              className={cn(
                "flex items-center gap-2 cursor-pointer w-full transition-all",
                portal === "regulator" && "focus:bg-white/5 focus:text-white",
                isSettingsActive && "font-bold",
                isSettingsActive &&
                  portal === "sme" &&
                  "bg-zinc-100 dark:bg-purple-900/40 text-zinc-900 dark:text-purple-300",
                isSettingsActive &&
                  portal === "regulator" &&
                  cn(activeBg, activeText)
              )}
            >
              <Settings
                size={14}
                className={cn(
                  "transition-colors",
                  portal === "regulator" ? "text-zinc-500" : "text-gray-400",
                  isSettingsActive &&
                    (portal === "regulator"
                      ? activeText
                      : "text-zinc-900 dark:text-purple-300")
                )}
              />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator
            className={
              portal === "regulator" ? "bg-white/5" : "dark:bg-zinc-700"
            }
          />

          <DropdownMenuItem
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400",
              portal === "regulator"
                ? "focus:bg-red-500/10"
                : "focus:bg-red-50 dark:focus:bg-red-900/10"
            )}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
