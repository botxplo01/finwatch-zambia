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
  portal: "sme" | "regulator" | "analyst";
  steps: TutorialStep[];
}

/**
 * Shared step content for SME portal to ensure consistency
 */
const SME_COMMON_STEPS = {
  overview: {
    targetId: "nav-overview",
    title: "SME Dashboard",
    content: "Welcome to your command center. This overview tracks your company count, active predictions, and overall portfolio health.",
  },
  companies: {
    targetId: "nav-companies",
    title: "Business Profiles",
    content: "Register and manage your SMEs here. You'll need a company profile before running any predictions.",
  },
  predict: {
    targetId: "nav-predict",
    title: "Run Analysis",
    content: "Initiate new financial distress predictions by entering your balance sheet and income statement data.",
  },
  history: {
    targetId: "nav-history",
    title: "Historical Records",
    content: "Access every assessment ever run in your account to monitor your business's trajectory over time.",
  },
  reports: {
    targetId: "nav-reports",
    title: "Institutional Reports",
    content: "Export your results as PDFs or CSVs for your company's internal assessments or policy reviews.",
  },
  profile: {
    targetId: "nav-user-profile",
    title: "Profile & Settings",
    content: "Manage your profile, account settings, and portal experience from this menu.",
  },
  glossary: {
    targetId: "floating-glossary-button",
    title: "System Glossary",
    content: "Struggling with a financial term? Use the glossary to find plain-language definitions and Zambian business examples for every concept in the system.",
  },
  assistant: {
    targetId: "ai-assistant-fab",
    title: "AI Assistant",
    content: "Our context-aware AI assistant is always here to help explain complex ratios, interpret model drivers.",
  },
  help: {
    targetId: "info-trigger",
    title: "Need more help?",
    content: "You can learn more about FinWatch or restart this guided tour at any time from this System Overview panel. We are here to support your business growth.",
  }
};

/**
 * Desktop SME Tutorial Sequence:
 * 1. Dashboard, 2. Companies, 3. Predictions, 4. History, 5. Reports, 6. Profile, 7. Glossary, 8. AI Assistant, 9. System Overview
 */
export const SME_DESKTOP_CONFIG: TutorialConfig = {
  portal: "sme",
  steps: [
    SME_COMMON_STEPS.overview,
    SME_COMMON_STEPS.companies,
    SME_COMMON_STEPS.predict,
    SME_COMMON_STEPS.history,
    SME_COMMON_STEPS.reports,
    SME_COMMON_STEPS.profile,
    SME_COMMON_STEPS.glossary,
    SME_COMMON_STEPS.assistant,
    SME_COMMON_STEPS.help,
  ],
};

/**
 * Mobile SME Tutorial Sequence:
 * 1. Dashboard, 2. Companies, 3. Predictions, 4. History, 5. Glossary, 6. AI Assistant, 7. Reports, 8. Profile, 9. System Overview
 */
export const SME_MOBILE_CONFIG: TutorialConfig = {
  portal: "sme",
  steps: [
    SME_COMMON_STEPS.overview,
    SME_COMMON_STEPS.companies,
    SME_COMMON_STEPS.predict,
    SME_COMMON_STEPS.history,
    SME_COMMON_STEPS.glossary,
    SME_COMMON_STEPS.assistant,
    SME_COMMON_STEPS.reports,
    SME_COMMON_STEPS.profile,
    SME_COMMON_STEPS.help,
  ],
};

/**
 * Legacy export for backward compatibility
 */
export const SME_TUTORIAL_CONFIG = SME_DESKTOP_CONFIG;

/**
 * Helper to get the correct SME configuration based on platform
 */
export const getSmeTutorialConfig = (isMobile: boolean): TutorialConfig => {
  return isMobile ? SME_MOBILE_CONFIG : SME_DESKTOP_CONFIG;
};

/**
 * Shared step content for institutional portal
 */
const REG_COMMON_STEPS = {
  overview: {
    targetId: "nav-overview",
    title: "Regulator Overview",
    content: "Monitor sector-wide financial health. This dashboard provides high-level KPIs and risk distribution metrics across all registered SMEs.",
  },
  trends: {
    targetId: "nav-trends",
    title: "Temporal Trends",
    content: "Track how financial distress patterns evolve over time with monthly aggregate projections.",
  },
  insights: {
    targetId: "nav-insights",
    title: "Sector Insights",
    content: "Deep dive into industry-specific data. Compare performance between different sectors of the Zambian economy.",
  },
  anomalies: {
    targetId: "nav-anomalies",
    title: "Anomaly Detection",
    content: "Identify high-risk cases that exceed system thresholds for immediate supervisory attention.",
  },
  reports: {
    targetId: "nav-reports",
    title: "Institutional Reporting",
    content: "Generate and export anonymised system-wide reports in PDF, CSV, or JSON formats for policy review.",
  },
  settings: {
    targetId: "nav-user-profile",
    title: "Profile & Settings",
    content: "Manage your profile, account settings, and portal experience from this menu.",
  },
  assistant: {
    targetId: "ai-assistant-fab",
    title: "Analytical Assistant",
    content: "Use our AI to help interpret complex sector risk patterns or investigate specific data anomalies.",
  },
  help: {
    targetId: "info-trigger",
    title: "Need more help?",
    content: "You can learn more about FinWatch or restart this guided tour at any time from this System Overview panel. We are here to support your regulatory oversight.",
  }
};

/**
 * Desktop Regulator Tutorial Sequence
 */
export const REGULATOR_DESKTOP_CONFIG: TutorialConfig = {
  portal: "regulator",
  steps: [
    REG_COMMON_STEPS.overview,
    REG_COMMON_STEPS.trends,
    REG_COMMON_STEPS.insights,
    REG_COMMON_STEPS.anomalies,
    REG_COMMON_STEPS.reports,
    REG_COMMON_STEPS.settings,
    REG_COMMON_STEPS.assistant,
    REG_COMMON_STEPS.help,
  ],
};

/**
 * Mobile Regulator Tutorial Sequence
 */
export const REGULATOR_MOBILE_CONFIG: TutorialConfig = {
  portal: "regulator",
  steps: [
    REG_COMMON_STEPS.overview,
    REG_COMMON_STEPS.trends,
    REG_COMMON_STEPS.insights,
    REG_COMMON_STEPS.anomalies,
    REG_COMMON_STEPS.reports,
    REG_COMMON_STEPS.settings,
    REG_COMMON_STEPS.assistant,
    REG_COMMON_STEPS.help,
  ],
};

/**
 * Helper to get the correct Regulator configuration based on platform
 */
export const getRegTutorialConfig = (isMobile: boolean): TutorialConfig => {
  return isMobile ? REGULATOR_MOBILE_CONFIG : REGULATOR_DESKTOP_CONFIG;
};

/**
 * Centralized Policy Analyst Tutorial Sequence
 */
export const ANALYST_DESKTOP_CONFIG: TutorialConfig = {
  portal: "analyst",
  steps: [
    {
      targetId: "nav-overview",
      title: "Overview",
      content:
        "Welcome to your analysis dashboard. Monitor high-level systemic KPIs and risk distribution across all assessed Zambian SMEs.",
    },
    {
      targetId: "nav-trends",
      title: "Temporal Trends",
      content:
        "Observe the evolution of financial distress patterns over time with our monthly aggregate data projections.",
    },
    {
      targetId: "nav-insights",
      title: "Sector Insights",
      content:
        "Analyse industry-specific performance. Compare key financial ratios between different sectors to identify emerging pressures.",
    },
    {
      targetId: "nav-reports",
      title: "Policy Reporting",
      content:
        "Generate and export comprehensive aggregate reports. Your Analyst exports automatically suppress sensitive company-level anomaly data.",
    },
    {
      targetId: "nav-user-profile",
      title: "Profile & Settings",
      content:
        "Manage your profile, account settings, and portal experience from this menu.",
    },
    {
      targetId: "ai-assistant-fab",
      title: "AI Assistant",
      content:
        "Use the AI assistant to interpret complex sector trends or ask for high-level synthesis of current economic patterns.",
    },
    {
      targetId: "info-trigger",
      title: "Need more help?",
      content:
        "Access system guidance or restart this tour at any time from this System Overview panel. We are here to support your data-driven policy decisions.",
    },
  ],
};

export const ANALYST_MOBILE_CONFIG = ANALYST_DESKTOP_CONFIG;

export const getAnalystTutorialConfig = (isMobile: boolean): TutorialConfig => {
  return isMobile ? ANALYST_MOBILE_CONFIG : ANALYST_DESKTOP_CONFIG;
};

/**
 * Legacy exports for backward compatibility
 */
export const REGULATOR_TUTORIAL_CONFIG = REGULATOR_DESKTOP_CONFIG;
export const ANALYST_TUTORIAL_CONFIG = ANALYST_DESKTOP_CONFIG;

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
