"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import {
  getInstitutionalUser,
  getInstitutionalAuthHeader,
  InstitutionalUserResponse,
} from "@/lib/institutional-auth";

interface Sector {
  name: string;
  scale: string;
}

interface InstitutionalFilterContextType {
  availableScales: string[];
  availableSectors: Sector[];
  availableSecors: Sector[];
  selectedScales: string[];
  selectedSectors: string[];
  setSelectedScales: (scales: string[]) => void;
  setSelectedSectors: (sectors: string[]) => void;
  isFilterLoading: boolean;
  role: string;
  allSectors: Sector[];
}

const InstitutionalFilterContext = createContext<InstitutionalFilterContextType | undefined>(undefined);

export function InstitutionalFilterProvider({ children }: { children: React.ReactNode }) {
  const [allScales, setAllScales] = useState<string[]>([]);
  const [allSectors, setAllSectors] = useState<Sector[]>([]);
  const [selectedScales, setSelectedScales] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isFilterLoading, setIsFilterLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string>("policy_analyst");
  const [storageKey, setStorageKey] = useState<string>("inst_filter_analyst");

  const fetchFilterOptions = async (key: string) => {
    setIsFilterLoading(true);
    try {
      const res = await api.get("/api/institutional/filter-options", {
        headers: getInstitutionalAuthHeader(),
      });
      const { scales, sectors } = res.data;
      setAllScales(scales || []);
      setAllSectors(sectors || []);
      setSelectedScales(scales || []);
      setSelectedSectors((sectors || []).map((s: Sector) => s.name));

      const initialState = {
        allScales: scales || [],
        allSectors: sectors || [],
        selectedScales: scales || [],
        selectedSectors: (sectors || []).map((s: Sector) => s.name),
      };
      sessionStorage.setItem(key, JSON.stringify(initialState));
    } catch (error) {
      console.error("Failed to fetch institutional filter options:", error);
    } finally {
      setIsFilterLoading(false);
    }
  };

  useEffect(() => {
    const user = getInstitutionalUser<InstitutionalUserResponse>();
    const userRole = user?.role || "policy_analyst";
    setRole(userRole);
    const key = userRole === "regulator" ? "inst_filter_regulator" : "inst_filter_analyst";
    setStorageKey(key);

    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAllScales(parsed.allScales || []);
        setAllSectors(parsed.allSectors || []);
        setSelectedScales(parsed.selectedScales || []);
        setSelectedSectors(parsed.selectedSectors || []);
        setIsFilterLoading(false);
      } catch (e) {
        sessionStorage.removeItem(key);
        fetchFilterOptions(key);
      }
    } else {
      fetchFilterOptions(key);
    }
    setReady(true);
  }, []);

  // Debounced sessionStorage sync
  useEffect(() => {
    if (isFilterLoading || !ready) return;

    const timer = setTimeout(() => {
      const stateToSave = {
        allScales,
        allSectors,
        selectedScales,
        selectedSectors,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedScales, selectedSectors, allScales, allSectors, isFilterLoading, storageKey, ready]);

  // Sector filter behavior:
  // UI available sectors filtered dynamically when selectedScales changes
  const availableSectors = useMemo(() => {
    return allSectors.filter((s) => selectedScales.includes(s.scale));
  }, [allSectors, selectedScales]);

  const handleSetSelectedScales = (newScales: string[]) => {
    setSelectedScales(newScales);
    setSelectedSectors((prev) => {
      // automatically drop selectedSectors whose scale is not in newScales
      return prev.filter((sectorName) => {
        const sectorObj = allSectors.find((s) => s.name === sectorName);
        return sectorObj ? newScales.includes(sectorObj.scale) : false;
      });
    });
  };

  const handleSetSelectedSectors = (newSectors: string[]) => {
    setSelectedSectors(newSectors);
  };

  const value = useMemo(
    () => ({
      availableScales: allScales,
      availableSectors,
      availableSecors: availableSectors,
      selectedScales,
      selectedSectors,
      setSelectedScales: handleSetSelectedScales,
      setSelectedSectors: handleSetSelectedSectors,
      isFilterLoading,
      role,
      allSectors,
    }),
    [allScales, availableSectors, selectedScales, selectedSectors, isFilterLoading, role, allSectors]
  );

  return (
    <InstitutionalFilterContext.Provider value={value}>
      {children}
    </InstitutionalFilterContext.Provider>
  );
}

export function useInstitutionalFilter() {
  const context = useContext(InstitutionalFilterContext);
  if (context === undefined) {
    throw new Error("useInstitutionalFilter must be used within an InstitutionalFilterProvider");
  }
  return context;
}
