"use client";

/**
 * FinWatch Zambia - Documentation Sidebar
 *
 * Collapsible, hierarchical sidebar for documentation navigation.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Rocket,
  BarChart2,
  BookOpen,
  Upload,
  Sparkles,
  FileText,
  Shield,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    title: "Getting Started",
    icon: Rocket,
    route: "/docs/getting-started",
    items: [
      { title: "What is FinWatch Zambia", id: "what-is-finwatch" },
      { title: "Creating your account", id: "creating-account" },
      { title: "Creating your first company", id: "creating-company" },
      { title: "Running your first prediction", id: "first-prediction" },
    ]
  },
  {
    title: "Understanding Results",
    icon: BarChart2,
    route: "/docs/understanding-results",
    items: [
      { title: "What the risk score means", id: "risk-score" },
      { title: "Distressed vs. Healthy", id: "classification" },
      { title: "How to read the SHAP chart", id: "shap-chart" },
      { title: "Understanding the AI narrative", id: "narrative" },
    ]
  },
  {
    title: "Financial Concepts",
    icon: BookOpen,
    route: "/docs/financial-concepts",
    items: [
      { title: "Liquidity Ratios", id: "liquidity" },
      { title: "Leverage Ratios", id: "leverage" },
      { title: "Profitability Ratios", id: "profitability" },
      { title: "Machine Learning Basics", id: "ml-basics" },
    ]
  },
  {
    title: "Submitting Data",
    icon: Upload,
    route: "/docs/submitting-data",
    items: [
      { title: "Manual Entry", id: "manual-entry" },
      { title: "Document Upload", id: "document-upload" },
      { title: "Re-using Previous Data", id: "data-reuse" },
    ]
  },
  {
    title: "AI Assistant",
    icon: Sparkles,
    route: "/docs/ai-assistant",
    items: [
      { title: "What it can help with", id: "assistant-scope" },
      { title: "Usage Limits", id: "usage-limits" },
    ]
  },
  {
    title: "Reports",
    icon: FileText,
    route: "/docs/reports",
    items: [
      { title: "Generating PDF Reports", id: "pdf-reports" },
      { title: "What the report contains", id: "report-content" },
    ]
  },
  {
    title: "Account & Privacy",
    icon: Shield,
    route: "/docs/account-privacy",
    items: [
      { title: "Your Data Privacy", id: "privacy" },
      { title: "Managing Settings", id: "settings" },
      { title: "Deleting Your Account", id: "deletion" },
    ]
  },
  {
    title: "Troubleshooting",
    icon: Wrench,
    route: "/docs/troubleshooting",
    items: [
      { title: "Common Issues", id: "common-issues" },
      { title: "Login Problems", id: "login-problems" },
    ]
  }
];

export function DocsSidebar() {
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
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/10",
                isActive
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", isActive ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400")} />
                <Link
                  href={section.route}
                  onClick={(e) => {
                    // Prevent button click from toggling if clicking the link itself
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
                    className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10"
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
