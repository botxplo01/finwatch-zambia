"use client";

/**
 * FinWatch Zambia - Documentation Content Layout
 *
 * Shared layout for all documentation section pages.
 * Includes breadcrumbs, the custom sidebar, and mobile-responsive navigation.
 */

import { ReactNode, useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  Search,
} from "lucide-react";
import Fuse from "fuse.js";
import { docsSearchIndex } from "@/lib/docs-search-index";
import { DocsSidebar } from "./DocsSidebar";
import { DocsSearchModal } from "./DocsSearchModal";
import { cn } from "@/lib/utils";

interface DocsContentLayoutProps {
  children: ReactNode;
  title: string;
  previousSection?: { title: string; route: string };
  nextSection?: { title: string; route: string };
}

export function DocsContentLayout({
  children,
  title,
  previousSection,
  nextSection,
}: DocsContentLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]);
  const [scrolled, setScrolled] = useState(false);

  // Mobile search state
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobileResults, setMobileResults] = useState<any[]>([]);

  const fuse = useMemo(
    () =>
      new Fuse(docsSearchIndex, {
        keys: [
          { name: "heading", weight: 0.5 },
          { name: "tags", weight: 0.3 },
          { name: "excerpt", weight: 0.2 },
        ],
        threshold: 0.4,
        includeMatches: true,
      }),
    []
  );

  useEffect(() => {
    if (mobileQuery.length >= 2) {
      setMobileResults(fuse.search(mobileQuery).slice(0, 5));
    } else {
      setMobileResults([]);
    }
  }, [mobileQuery, fuse]);

  // Scroll detection for sticky pill
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Find all h2 headings in the content
  useEffect(() => {
    const h2Elements = document.querySelectorAll("article h2[id]");
    const extractedHeadings = Array.from(h2Elements).map((el) => ({
      id: el.id,
      text: el.textContent || "",
    }));
    setHeadings(extractedHeadings);
  }, [children]);

  // Sync scroll with sidebar active heading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -70% 0px" }
    );

    const elements = document.querySelectorAll("article h2[id]");
    elements.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/sme/docs"
          className="hover:text-purple-600 transition-colors"
        >
          Documentation
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <div className="flex flex-col gap-12 lg:flex-row">
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-border">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="group mb-6 flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-400 transition-all hover:border-purple-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-purple-900/50 dark:hover:bg-zinc-900 shadow-sm"
            >
              <Search
                size={16}
                className="group-hover:text-purple-600 transition-colors"
              />
              <span className="flex-1 text-left font-medium">Search...</span>
              <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 text-[10px] font-bold text-zinc-400 group-hover:border-purple-200 group-hover:text-purple-600 dark:border-zinc-800 dark:bg-zinc-950 xl:block">
                /
              </kbd>
            </button>

            <DocsSidebar />
          </div>
        </aside>

        {/* Docs Search Modal */}
        <DocsSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
        <div
          className={cn(
            "lg:hidden z-40 transition-all duration-500 ease-in-out",
            scrolled
              ? "sticky top-20 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-border rounded-full px-6 py-2 shadow-xl mb-8"
              : "relative mb-6"
          )}
        >
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg transition-all duration-300",
              scrolled
                ? "py-1 text-xs"
                : "border border-border bg-white p-3 text-sm font-medium dark:bg-zinc-900"
            )}
          >
            <div className="flex items-center gap-2">
              <Menu
                className={cn(
                  "text-purple-600 transition-all",
                  scrolled ? "h-3.5 w-3.5" : "h-4 w-4"
                )}
              />
              <span
                className={cn(
                  scrolled ? "font-bold text-muted-foreground" : "font-medium"
                )}
              >
                Explore Documentation
              </span>
            </div>
            <ChevronRight
              className={cn(
                "transition-all text-muted-foreground",
                scrolled ? "h-3.5 w-3.5" : "h-4 w-4"
              )}
            />
          </button>
        </div>

        {/* Full-screen Mobile Menu Overlay (Moved outside sticky container to avoid stacking context issues) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm lg:hidden overflow-hidden flex flex-col animate-in fade-in duration-200">
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Menu className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-bold">Documentation</h3>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 pb-10">
                {/* Inline Mobile Search */}
                <div className="mb-6 relative group">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-600 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Search documentation..."
                    value={mobileQuery}
                    onChange={(e) => setMobileQuery(e.target.value)}
                    className="w-full h-12 pl-11 pr-4 py-2.5 text-sm border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 dark:focus:ring-purple-900/40 text-zinc-900 dark:text-zinc-100 transition-all shadow-sm"
                  />
                </div>
                {mobileResults.length > 0 && (
                  <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h4 className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Search Results
                    </h4>
                    {mobileResults.map((result, i) => (
                      <Link
                        key={i}
                        href={result.item.route}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex flex-col p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm active:scale-[0.98] transition-all"
                      >
                        <span className="text-[9px] font-bold text-purple-600 uppercase mb-1">
                          {result.item.section}
                        </span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {result.item.heading}
                        </span>
                      </Link>
                    ))}
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-6" />
                  </div>
                )}

                <div onClick={() => setIsMobileMenuOpen(false)}>
                  <DocsSidebar />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 max-w-4xl">
          <article className="prose prose-zinc dark:prose-invert max-w-none prose-h1:tracking-tight prose-h1:font-extrabold prose-h2:tracking-tight prose-h2:border-b prose-h2:pb-2 prose-h2:mt-12 prose-a:text-purple-600 dark:prose-a:text-purple-400 no-underline hover:prose-a:underline">
            <h1 id="_top" className="scroll-mt-24">
              {title}
            </h1>
            <div className="mt-8 space-y-8 leading-relaxed text-zinc-700 dark:text-zinc-300">
              {children}
            </div>
          </article>
          <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            {previousSection ? (
              <Link
                href={previousSection.route}
                className="group flex flex-col gap-1 rounded-lg border border-border p-4 transition-all hover:border-purple-600/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/5 sm:w-1/2"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </span>
                <span className="text-sm font-semibold group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  {previousSection.title}
                </span>
              </Link>
            ) : (
              <div className="sm:w-1/2" />
            )}

            {nextSection ? (
              <Link
                href={nextSection.route}
                className="group flex flex-col items-end gap-1 rounded-lg border border-border p-4 transition-all hover:border-purple-600/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/5 sm:w-1/2"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-sm font-semibold group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  {nextSection.title}
                </span>
              </Link>
            ) : (
              <div className="sm:w-1/2" />
            )}
          </div>
        </div>
        <aside className="hidden w-56 flex-shrink-0 xl:block">
          <div className="sticky top-24">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On this page
            </h4>
            <div className="flex flex-col gap-3">
              <Link
                href="#_top"
                className={cn(
                  "text-xs transition-colors hover:text-purple-600 dark:hover:text-purple-400",
                  !activeHeading || activeHeading === "_top"
                    ? "text-purple-600 font-medium"
                    : "text-muted-foreground"
                )}
              >
                Introduction
              </Link>
              {headings.map((heading) => (
                <Link
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={cn(
                    "text-xs transition-colors hover:text-purple-600 dark:hover:text-purple-400 pl-3 border-l border-transparent",
                    activeHeading === heading.id
                      ? "text-purple-600 font-medium border-purple-600"
                      : "text-muted-foreground hover:border-border"
                  )}
                >
                  {heading.text}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
