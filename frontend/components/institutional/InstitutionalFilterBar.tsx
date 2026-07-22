"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useInstitutionalFilter } from "@/context/InstitutionalFilterContext";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function InstitutionalFilterBar() {
  const {
    availableScales,
    selectedScales,
    selectedSectors,
    setSelectedScales,
    setSelectedSectors,
    isFilterLoading,
    role,
    allSectors,
  } = useInstitutionalFilter();

  const isAnalyst = role === "policy_analyst";

  // Theme styling based on role
  const accentBg = isAnalyst ? "bg-blue-600 dark:bg-blue-500" : "bg-emerald-600 dark:bg-emerald-500";
  const accentText = isAnalyst ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400";

  // Local draft states
  const [draftScales, setDraftScales] = useState<string[]>([]);
  const [draftSectors, setDraftSectors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync draft states with context when context changes (e.g. initial load or reset)
  useEffect(() => {
    setDraftScales(selectedScales);
    setDraftSectors(selectedSectors);
  }, [selectedScales, selectedSectors]);

  // Click outside listener to close the dropdown popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sector list available in the UI based on draft scales
  const uiAvailableSectors = useMemo(() => {
    return allSectors.filter((s) => draftScales.includes(s.scale));
  }, [allSectors, draftScales]);

  // Toggle selection for a single scale in draft
  const handleToggleScale = (scale: string) => {
    let newScales: string[];
    if (draftScales.includes(scale)) {
      newScales = draftScales.filter((s) => s !== scale);
    } else {
      newScales = [...draftScales, scale];
    }
    setDraftScales(newScales);

    // Drop draftSectors whose scale is not in newScales
    setDraftSectors((prev) =>
      prev.filter((sectorName) => {
        const sectorObj = allSectors.find((s) => s.name === sectorName);
        return sectorObj ? newScales.includes(sectorObj.scale) : false;
      })
    );
  };

  // Toggle selection for a single sector in draft
  const handleToggleSector = (sectorName: string) => {
    if (draftSectors.includes(sectorName)) {
      setDraftSectors(draftSectors.filter((s) => s !== sectorName));
    } else {
      setDraftSectors([...draftSectors, sectorName]);
    }
  };

  // Select all / Deselect all for draft scales
  const allDraftScalesSelected = draftScales.length === availableScales.length;
  const handleSelectAllScales = () => {
    if (allDraftScalesSelected) {
      setDraftScales([]);
      setDraftSectors([]);
    } else {
      setDraftScales(availableScales);
      setDraftSectors(allSectors.map((s) => s.name));
    }
  };

  // Select all / Deselect all for draft sectors
  const allDraftSectorsSelected = draftSectors.length === uiAvailableSectors.length;
  const handleSelectAllSectors = () => {
    if (allDraftSectorsSelected) {
      const viewSectorNames = uiAvailableSectors.map((s) => s.name);
      setDraftSectors(draftSectors.filter((name) => !viewSectorNames.includes(name)));
    } else {
      const viewSectorNames = uiAvailableSectors.map((s) => s.name);
      const union = Array.from(new Set([...draftSectors, ...viewSectorNames]));
      setDraftSectors(union);
    }
  };

  // Apply filters: commit draft selections to the global context
  const handleApply = () => {
    setSelectedScales(draftScales);
    setSelectedSectors(draftSectors);
    setExpanded(false); // collapse layout after applying
  };

  // Reset filters: reset both context and local drafts to all selected
  const handleReset = () => {
    setSelectedScales(availableScales);
    setSelectedSectors(allSectors.map((s) => s.name));
  };

  if (isFilterLoading) {
    return (
      <div className="w-full bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-2xl p-4 shadow-sm animate-pulse mb-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-[74px] mb-6 z-20">
      {/* The unified solid card that expands downward instantly */}
      <div
        className={cn(
          "absolute top-0 left-0 w-full overflow-hidden rounded-2xl border shadow-sm dark:shadow-none z-20",
          "bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800/80"
        )}
      >
        <div
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/40 transition-colors duration-300"
        >
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
              Filters
            </h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              Filter data by business scale and industry sector
            </p>
          </div>
          <div className="flex items-center justify-center p-1.5 rounded-full bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            {expanded ? (
              <ChevronUp size={16} className="text-gray-500 dark:text-zinc-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-500 dark:text-zinc-400" />
            )}
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 md:px-6 md:pb-6 flex flex-col gap-4 border-t border-gray-100 dark:border-zinc-800/80 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Business Scale Selection (1/4 width) */}
              <div className="md:col-span-1 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Business Scale
                  </label>
                  <button
                    onClick={handleSelectAllScales}
                    className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {allDraftScalesSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="flex flex-col gap-2 bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100 dark:border-zinc-900/50 p-3 rounded-xl">
                  {availableScales.map((scale) => {
                    const isChecked = draftScales.includes(scale);
                    return (
                      <label
                        key={scale}
                        className={cn(
                          "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border border-transparent",
                          isChecked
                            ? cn("bg-white dark:bg-zinc-900 shadow-sm border-gray-100 dark:border-zinc-800", accentText)
                            : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100/50 dark:hover:bg-zinc-900/40"
                        )}
                        onClick={() => handleToggleScale(scale)}
                      >
                        <span>{scale}</span>
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                            isChecked
                              ? cn(accentBg, "border-transparent text-white")
                              : "border-gray-300 dark:border-zinc-700"
                          )}
                        >
                          {isChecked && <Check size={10} strokeWidth={3} />}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Industry Sectors Selection (3/4 width) */}
              <div className="md:col-span-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Industry Sectors
                  </label>
                  <button
                    onClick={handleSelectAllSectors}
                    className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {allDraftSectorsSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100 dark:border-zinc-900/50 p-3 rounded-xl min-h-[82px] flex flex-wrap gap-2 items-center">
                  {uiAvailableSectors.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 text-center w-full py-4">
                      Select a business scale to display available industry sectors.
                    </p>
                  ) : (
                    uiAvailableSectors.map((sector) => {
                      const isChecked = draftSectors.includes(sector.name);
                      return (
                        <button
                          key={`${sector.name}-${sector.scale}`}
                          onClick={() => handleToggleSector(sector.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border",
                            isChecked
                              ? cn(
                                  "bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 border-gray-200 dark:border-zinc-800 shadow-sm",
                                  isAnalyst ? "hover:border-blue-500/50" : "hover:border-emerald-500/50"
                                )
                              : "bg-transparent text-gray-400 dark:text-zinc-500 border-gray-200/50 dark:border-zinc-800/40 hover:bg-gray-100/50 dark:hover:bg-zinc-900/50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all",
                              isChecked
                                ? cn(accentBg, "border-transparent text-white")
                                : "border-gray-300 dark:border-zinc-700"
                            )}
                          >
                            {isChecked && <Check size={8} strokeWidth={4} />}
                          </div>
                          <span>{sector.name}</span>
                          <span className="text-[9px] opacity-60 font-normal">
                            ({sector.scale === "Small Scale" ? "Small" : "Medium"})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100/50 dark:border-zinc-900/50 pt-4 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-9 px-4 text-xs font-semibold flex items-center gap-1.5 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900"
              >
                <RotateCcw size={12} />
                Reset
              </Button>

              <Button
                size="sm"
                onClick={handleApply}
                className={cn(
                  "h-9 px-5 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98]",
                  accentBg
                )}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
