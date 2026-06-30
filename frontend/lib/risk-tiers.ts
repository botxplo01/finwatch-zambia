export const RISK_THRESHOLDS = {
  HIGH: 0.70,
  MEDIUM: 0.40,
} as const;

export type RiskTier = "High" | "Medium" | "Low";

export function getRiskTier(probability: number): RiskTier {
  if (probability >= RISK_THRESHOLDS.HIGH) return "High";
  if (probability >= RISK_THRESHOLDS.MEDIUM) return "Medium";
  return "Low";
}

export function isHighRisk(probability: number): boolean {
  return getRiskTier(probability) === "High";
}

export function isMediumRisk(probability: number): boolean {
  return getRiskTier(probability) === "Medium";
}

export function isLowRisk(probability: number): boolean {
  return getRiskTier(probability) === "Low";
}
