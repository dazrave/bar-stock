// Volume parsing and formatting utilities
// Supports: ml, cl, oz, %, plain numbers, fractions

// 1 oz = 29.5735ml, rounded to 30ml for simplicity
const OZ_TO_ML = 30;

// Common fraction patterns
const FRACTIONS: Record<string, number> = {
  "1/4": 0.25,
  "1/3": 0.333,
  "1/2": 0.5,
  "2/3": 0.667,
  "3/4": 0.75,
};

/**
 * Parse a volume string into milliliters
 * @param input - Volume string (e.g., "700ml", "70cl", "1.5oz", "50%", "700")
 * @param totalMl - Required for percentage calculations
 * @returns Volume in ml, or null if invalid
 */
export function parseVolume(input: string, totalMl?: number): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Percentage (requires totalMl)
  const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    if (!totalMl) return null;
    const percent = parseFloat(percentMatch[1]);
    return Math.round((percent / 100) * totalMl);
  }

  // Ounces (e.g., "1.5oz", "2 oz")
  const ozMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*oz$/);
  if (ozMatch) {
    return Math.round(parseFloat(ozMatch[1]) * OZ_TO_ML);
  }

  // Centiliters (e.g., "70cl", "35 cl")
  const clMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*cl$/);
  if (clMatch) {
    return Math.round(parseFloat(clMatch[1]) * 10);
  }

  // Milliliters (explicit or just number, e.g., "700ml", "700 ml", "700")
  const mlMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:ml)?$/);
  if (mlMatch) {
    return Math.round(parseFloat(mlMatch[1]));
  }

  return null;
}

/**
 * Parse oz measures that may include fractions (common in cocktail recipes)
 * @param measure - Measure string (e.g., "1 1/2 oz", "3/4 oz", "2 oz Vodka")
 * @returns Volume in ml, or null if not an oz measure
 */
export function parseOzMeasure(measure: string): number | null {
  const trimmed = measure.trim().toLowerCase();

  // Match patterns like "1 1/2 oz", "1/2 oz", "2 oz"
  // Also handles "1 1/2 oz Vodka" by stopping at oz
  const ozPattern = /^(\d+)?\s*(\d\/\d)?\s*oz/;
  const match = trimmed.match(ozPattern);

  if (!match) {
    // Try simple decimal oz: "1.5 oz"
    const simpleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*oz/);
    if (simpleMatch) {
      return Math.round(parseFloat(simpleMatch[1]) * OZ_TO_ML);
    }
    return null;
  }

  let total = 0;

  // Whole number part (e.g., "1" in "1 1/2 oz")
  if (match[1]) {
    total += parseInt(match[1]);
  }

  // Fraction part (e.g., "1/2" in "1 1/2 oz")
  if (match[2]) {
    const fraction = FRACTIONS[match[2]];
    if (fraction) {
      total += fraction;
    } else {
      // Try to parse as actual fraction
      const [num, denom] = match[2].split("/").map(Number);
      if (num && denom) {
        total += num / denom;
      }
    }
  }

  // If we only have a fraction with no whole number
  if (!match[1] && !match[2]) {
    return null;
  }

  return Math.round(total * OZ_TO_ML);
}

/**
 * Format milliliters for display
 * @param ml - Volume in milliliters
 * @returns Formatted string (e.g., "700ml", "1.0L")
 */
export function formatVolume(ml: number): string {
  if (ml >= 1000) {
    return `${(ml / 1000).toFixed(1)}L`;
  }
  return `${ml}ml`;
}

/**
 * Convert ml to oz for display (when showing both)
 * @param ml - Volume in milliliters
 * @returns Volume in ounces
 */
export function mlToOz(ml: number): number {
  return Math.round((ml / OZ_TO_ML) * 10) / 10;
}

/**
 * Parse a fractional number string (e.g., "1 1/2", "1/2", "2")
 */
function parseFraction(str: string): number {
  let total = 0;
  const parts = str.trim().split(/\s+/);
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, denom] = part.split("/").map(Number);
      if (num && denom) total += num / denom;
    } else {
      total += parseFloat(part) || 0;
    }
  }
  return total;
}

/**
 * Format a CocktailDB measure for display, converting oz/tsp/tbsp/cl to ml
 * @param measure - Original measure string (e.g., "1 1/2 oz", "2 teaspoons")
 * @returns Formatted string in ml (e.g., "45ml") or original if not convertible
 */
export function formatMeasureWithMl(measure: string): string {
  if (!measure) return "";

  const ml = parseOzMeasure(measure);
  if (ml !== null) {
    return `${ml}ml`;
  }

  const trimmed = measure.trim().toLowerCase();

  // Check for cl and convert (1 cl = 10ml)
  const clMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*cl$/);
  if (clMatch) {
    return `${Math.round(parseFloat(clMatch[1]) * 10)}ml`;
  }

  // Check for teaspoons and convert (1 tsp = 5ml)
  const tspMatch = trimmed.match(/^([\d.\/\s]+)\s*(?:tsp|teaspoons?)$/);
  if (tspMatch) {
    const tsp = parseFraction(tspMatch[1]);
    if (tsp > 0) return `${Math.round(tsp * 5)}ml`;
  }

  // Check for tablespoons and convert (1 tbsp = 15ml)
  const tbspMatch = trimmed.match(/^([\d.\/\s]+)\s*(?:tbsp|tblsp|tablespoons?)$/);
  if (tbspMatch) {
    const tbsp = parseFraction(tbspMatch[1]);
    if (tbsp > 0) return `${Math.round(tbsp * 15)}ml`;
  }

  return measure.trim();
}
