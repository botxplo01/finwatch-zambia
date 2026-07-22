"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type AuthAccent = "purple" | "emerald" | "blue";

interface AuthAccentContextType {
  accent: AuthAccent;
  setAccent: (accent: AuthAccent) => void;
}

const AuthAccentContext = createContext<AuthAccentContextType | undefined>(
  undefined
);

export function AuthAccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<AuthAccent>("emerald");

  return (
    <AuthAccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AuthAccentContext.Provider>
  );
}

export function useAuthAccent() {
  const context = useContext(AuthAccentContext);
  if (context === undefined) {
    throw new Error("useAuthAccent must be used within an AuthAccentProvider");
  }
  return context;
}
