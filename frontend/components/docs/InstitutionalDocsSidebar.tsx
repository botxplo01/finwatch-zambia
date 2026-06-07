"use client";

/**
 * FinWatch Zambia - Institutional Documentation Sidebar
 *
 * Collapsible, hierarchical sidebar for institutional documentation navigation.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocLink {
  title: string;
  href: string;
  icon?: React.ReactNode;
}

interface DocSection {
  title: string;
  links: DocLink[];
}

const REGULATOR_SECTIONS: DocSection[] = [
  {
    title: "Getting Started",
    links: [
      {
        title: "Platform Overview",
        href: "/regulator/docs/overview",
        icon: <BookOpen size={14} />,
      },
      {
        title: "Governance Model",
        href: "/regulator/docs/governance",
        icon: <ShieldCheck size={14} />,
      },
    ],
  },
  {
    title: "Core Analytics",
    links: [
      {
        title: "Sector Trends",
        href: "/regulator/docs/sector-trends",
        icon: <TrendingUpIcon size={14} />,
      },
      {
        title: "Anomaly Detection",
        href: "/regulator/docs/anomaly-detection",
        icon: <AlertTriangle size={14} />,
      },
      {
        title: "Institutional Reporting",
        href: "/regulator/docs/reporting",
        icon: <Scale size={14} />,
      },
    ],
  },
  {
    title: "Support",
    links: [
      {
        title: "Frequently Asked Questions",
        href: "/regulator/docs/faq",
        icon: <HelpCircle size={14} />,
      },
    ],
  },
];

function TrendingUpIcon({ size }: { size: number }) {
  return <BarChart3 size={size} />;
}

export function InstitutionalDocsSidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(
    REGULATOR_SECTIONS.map((s) => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  return (
    <nav className="flex flex-col gap-1 py-4">
      {REGULATOR_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <button
            onClick={() => toggleSection(section.title)}
            className="flex items-center justify-between w-full text-left group px-3 py-2"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors">
              {section.title}
            </span>
            {expandedSections.includes(section.title) ? (
              <ChevronDown size={14} className="text-gray-300" />
            ) : (
              <ChevronRight size={14} className="text-gray-300" />
            )}
          </button>

          {expandedSections.includes(section.title) && (
            <div className="space-y-1">
              {section.links.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                      active
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
                    )}
                  >
                    {link.icon && (
                      <span className={cn(active ? "text-emerald-500" : "text-gray-400 dark:text-zinc-500")}>
                        {link.icon}
                      </span>
                    )}
                    {link.title}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
