"use client";

/**
 * FinWatch Zambia - Regulator Documentation Sidebar
 *
 * Collapsible, hierarchical sidebar for institutional documentation navigation.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Layout,
  TrendingUp,
  AlertTriangle,
  FileText,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Institutional Overview",
    icon: Layout,
    route: "/institutional/docs/overview",
    items: [
      { title: "System Purpose", id: "purpose" },
      { title: "Anonymization Standards", id: "anonymization" },
      { title: "Platform Architecture", id: "architecture" },
    ],
  },
  {
    title: "Sector Trends",
    icon: TrendingUp,
    route: "/institutional/docs/sector-trends",
    items: [
      { title: "Aggregate Analytics", id: "aggregate" },
      { title: "Reading the Heatmap", id: "heatmap" },
      { title: "Temporal Analysis", id: "temporal" },
    ],
  },
  {
    title: "Anomaly Detection",
    icon: AlertTriangle,
    route: "/institutional/docs/anomaly-detection",
    items: [
      { title: "Detection Logic", id: "logic" },
      { title: "Statistical Thresholds", id: "thresholds" },
      { title: "Investigating Flags", id: "investigation" },
    ],
  },
  {
    title: "Institutional Reporting",
    icon: FileText,
    route: "/institutional/docs/reporting",
    items: [
      { title: "Cross-Sector Summaries", id: "summaries" },
      { title: "CSV/Excel Data Exports", id: "exports" },
      { title: "Model Performance Metrics", id: "model-metrics" },
    ],
  },
  {
    title: "AI Governance",
    icon: ShieldCheck,
    route: "/institutional/docs/governance",
    items: [
      { title: "Model Transparency", id: "transparency" },
      { title: "Ethics and Fairness", id: "ethics" },
      { title: "System Audit Trails", id: "audit" },
    ],
  },
];

export function RegulatorDocsSidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(
    SECTIONS.filter((s) => pathname.startsWith(s.route)).map((s) => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  return (
    <nav className="flex flex-col gap-1 py-4">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.includes(section.title);
        const isActive = pathname.startsWith(section.route);

        return (
          <div key={section.title} className="flex flex-col gap-1">
            <button
              onClick={() => toggleSection(section.title)}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-purple-400"
                  )}
                />
                <Link
                  href={section.route}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="hover:underline"
                >
                  {section.title}
                </Link>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {isExpanded && (
              <div className="ml-9 flex flex-col gap-1 border-l border-border pl-2">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`${section.route}#${item.id}`}
                    className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
