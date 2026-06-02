/**
 * FinWatch Zambia - Canonical Business & Domain Rules
 *
 * Matching library for the frontend portal to ensure consistent 
 * enforcement of regulated sector constraints and assessment methodology.
 */

export const REGULATED_INDUSTRIES = [
  "Financial Services",
  "Healthcare",
  "Mining",
];

/**
 * Returns true if the industry belongs to the 'Regulated Quadrant'.
 */
export function isRegulatedIndustry(industry?: string | null): boolean {
  if (!industry) return false;
  return REGULATED_INDUSTRIES.includes(industry);
}

/**
 * Canonical methodology-selection rule.
 * A company requires Full Financial Assessment if it operates in a 
 * regulated sector OR belongs to an established Medium Scale enterprise.
 */
export function requiresFullAssessment(
  businessScale?: string,
  industry?: string | null
): boolean {
  return businessScale === "medium_scale" || isRegulatedIndustry(industry);
}
