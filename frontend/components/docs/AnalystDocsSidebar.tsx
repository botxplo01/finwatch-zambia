"use client";

/**
 * FinWatch Zambia - Policy Analyst Documentation Sidebar
 *
 * Collapsible, hierarchical sidebar for analytical documentation navigation.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  BarChart2,
  FileText,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Analytical Overview",
    icon: BookOpen,
    route: "/analyst/docs/overview",
    items: [
      { title: "Scope of Analysis", id: "scope" },
      { title: "Data Boundaries", id: "boundaries" },
    ]
  },
  {
    title: "Sector Performance",
    icon: TrendingUp,
    route: "/analyst/docs/sector-performance",
    items: [
      { title: "Interpreting Metrics", id: "metrics" },
      { title: "Economic Trend Tracking", id: "trends" },
    ]
  },
  {
    title: "Institutional Reporting",
    icon: FileText,
    route: "/analyst/docs/reporting",
    items: [
      { title: "Generating Policy Briefs", id: "policy-briefs" },
      { title: "Model Reliability", id: "reliability" },
    ]
  },
  {
    title: "AI Assistant Scope",
    icon: BarChart2,
    route: "/analyst/docs/assistant-scope",
    items: [
      { title: "Analytical Guidance", id: "guidance" },
      { title: "Usage Limits", id: "limits" },
    ]
  }
];

export function AnalystDocsSidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(
    SECTIONS.filter(s => pathname.startsWith(s.route)).map(s => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
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
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400")} />
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
                    className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
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
