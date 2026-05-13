"use client";

/**
 * FinWatch Zambia - Tutorial Context
 */

import React, { createContext, useContext, useState, useCallback } from "react";

export interface TutorialStep {
  targetId: string;
  title: string;
  content: string;
}

/**
 * Configuration for specific portal's tutorial flow.
 */
export interface TutorialConfig {
  portal: "sme" | "regulator";
  steps: TutorialStep[];
}

/**
 * Centralized SME Tutorial Sequence:
 * 1. Overview -> 2. Companies -> 3. Predictions -> 4. History -> 5. AI Assistant -> 6. Reports -> 7. Settings -> 8. System Info
 */
export const SME_TUTORIAL_CONFIG: TutorialConfig = {
  portal: "sme",
  steps: [
    {
      targetId: "nav-overview",
      title: "SME Dashboard",
      content:
        "Welcome to your command center. This overview tracks your company count, active predictions, and overall portfolio health.",
    },
    {
      targetId: "nav-companies",
      title: "Business Profiles",
      content:
        "Register and manage your SMEs here. You'll need a company profile before running any predictions.",
    },
    {
      targetId: "nav-predict",
      title: "Run Analysis",
      content:
        "Initiate new financial distress predictions by entering your balance sheet and income statement data.",
    },
    {
      targetId: "nav-history",
      title: "Historical Records",
      content:
        "Access every assessment ever run in your account to monitor your business's trajectory over time.",
    },
    {
      targetId: "ai-assistant-fab",
      title: "AI Guidance",
      content:
        "Our context-aware AI assistant is always here to help explain complex ratios or interpret model drivers.",
    },
    {
      targetId: "nav-reports",
      title: "Institutional Reports",
      content:
        "Export your results as professional PDFs for bank submissions or internal policy reviews.",
    },
    {
      targetId: "nav-settings",
      title: "Portal Settings",
      content: "Manage your profile and portal preferences here.",
    },
    {
      targetId: "info-trigger",
      title: "Need more help?",
      content:
        "You can learn more about FinWatch or restart this guided tour at any time from this System Info panel. We are here to support your business growth.",
    },
  ],
};

/**
 * Centralized Regulator Tutorial Sequence:
 * 1. Overview -> 2. Trends -> 3. Insights -> 4. Anomalies -> 5. AI Assistant -> 6. Reports -> 7. Settings -> 8. System Info
 */
export const REGULATOR_TUTORIAL_CONFIG: TutorialConfig = {
  portal: "regulator",
  steps: [
    {
      targetId: "nav-overview",
      title: "Regulator Overview",
      content:
        "Monitor sector-wide financial health. This dashboard provides high-level KPIs and risk distribution metrics across all registered SMEs.",
    },
    {
      targetId: "nav-trends",
      title: "Temporal Trends",
      content:
        "Track how financial distress patterns evolve over time with monthly aggregate projections.",
    },
    {
      targetId: "nav-insights",
      title: "Sector Insights",
      content:
        "Deep dive into industry-specific data. Compare performance between different sectors of the Zambian economy.",
    },
    {
      targetId: "nav-anomalies",
      title: "Anomaly Detection",
      content:
        "Identify high-risk cases that exceed system thresholds for immediate supervisory attention.",
    },
    {
      targetId: "ai-assistant-fab",
      title: "Analytical Assistant",
      content:
        "Use our AI to help interpret complex sector risk patterns or investigate specific data anomalies.",
    },
    {
      targetId: "nav-reports",
      title: "Institutional Reporting",
      content:
        "Generate and export anonymised system-wide reports in PDF, CSV, or JSON formats for policy review.",
    },
    {
      targetId: "nav-settings",
      title: "Portal Settings",
      content: "Manage your profile and portal preferences here.",
    },
    {
      targetId: "info-trigger",
      title: "Need more help?",
      content:
        "You can learn more about FinWatch or restart this guided tour at any time from this System Info panel. We are here to support your regulatory oversight.",
    },
  ],
};

interface TutorialContextType {
  isActive: boolean;
  currentStepIndex: number;
  config: TutorialConfig | null;
  startTutorial: (config: TutorialConfig) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTutorial: () => void;
  completeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined,
);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [config, setConfig] = useState<TutorialConfig | null>(null);

  const startTutorial = useCallback((newConfig: TutorialConfig) => {
    setConfig(newConfig);
    setCurrentStepIndex(0);
    setIsActive(true);
    document.body.style.overflow = "hidden";
  }, []);

  const exitTutorial = useCallback(() => {
    setIsActive(false);
    setConfig(null);
    document.body.style.overflow = "auto";
  }, []);

  const completeTutorial = useCallback(() => {
    if (config) {
      localStorage.setItem(`hasCompletedTutorial_${config.portal}`, "true");
    }
    exitTutorial();
  }, [config, exitTutorial]);

  const nextStep = useCallback(() => {
    if (config && currentStepIndex < config.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      completeTutorial();
    }
  }, [config, currentStepIndex, completeTutorial]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStepIndex,
        config,
        startTutorial,
        nextStep,
        prevStep,
        exitTutorial,
        completeTutorial,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}
