import { AnalysisResult } from "../types";

/**
 * Total-consistency check for a generated MLOT report (Keith's ruling,
 * Oct 20, 2026): the headline total must always equal the sum of the category
 * breakdown, everywhere the report is shown. The AI states a total AND each
 * category figure independently, and the two can drift apart.
 *
 * This module is the single place that detects and repairs that drift:
 *  - the categories are the granular estimates — their values are never
 *    adjusted to force a match (a string-formatted value like "$45,000" is
 *    only coerced to the number 45000, which the views require);
 *  - when the stated total disagrees with the category sum by more than a
 *    $1 rounding tolerance, the total is corrected to the sum and a
 *    DriftEvent is returned so the caller can report it;
 *  - within tolerance the total is still normalized to the exact sum,
 *    silently — the report's figures agree to the dollar either way;
 *  - anything unparseable (a figure that is not plainly a number) aborts
 *    the check entirely: the report is returned untouched and no event is
 *    produced. We never guess at a figure.
 *
 * Pure and dependency-free (types only) so it can be unit-tested in
 * isolation — see scripts/test-report-totals.mjs.
 */

export interface DriftEvent {
  /** The total the AI originally stated. */
  statedTotal: number;
  /** The sum of the category breakdown — the corrected total. */
  computedSum: number;
  /** computedSum - statedTotal. */
  difference: number;
  /** Number of categories in the breakdown. */
  categoryCount: number;
  /** ISO-8601 timestamp of the check. */
  timestamp: string;
}

export interface TotalsOutcome {
  /** The report with a consistent total (or the original, untouched). */
  report: AnalysisResult;
  /** Set only when a beyond-tolerance drift was found and corrected. */
  drift: DriftEvent | null;
}

/** Beyond this many dollars of disagreement, drift counts as real. */
const TOLERANCE_DOLLARS = 1;

/**
 * Strictly parse a value that should be a dollar amount. Accepts a finite
 * number, or a plain numeric string with optional $ , and whitespace
 * ("$6,400,000", "45000", "45000.00"). Returns null for anything else —
 * including prose like "about 5000" — so the caller aborts rather than
 * guessing.
 */
const parseAmount = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function normalizeReportTotals(
  report: AnalysisResult,
  now: Date = new Date()
): TotalsOutcome {
  const untouched: TotalsOutcome = { report, drift: null };
  if (!report || typeof report !== "object") return untouched;

  const breakdown = Array.isArray(report.leakageBreakdown)
    ? report.leakageBreakdown
    : [];
  // No breakdown → nothing to check against. No event.
  if (breakdown.length === 0) return untouched;

  // Every category figure must parse to a non-negative number, or the
  // whole check aborts with the report untouched.
  const values: number[] = [];
  for (const category of breakdown) {
    const parsed = category
      ? parseAmount((category as { estimatedLeakage?: unknown }).estimatedLeakage)
      : null;
    if (parsed === null || parsed < 0) return untouched;
    values.push(parsed);
  }

  const computedSum = values.reduce((total, v) => total + v, 0);
  // An all-zero breakdown carries no information; don't overwrite a stated
  // total on the strength of it.
  if (!(computedSum > 0)) return untouched;

  const statedTotal = parseAmount(
    (report as { totalLeakage?: unknown }).totalLeakage
  );
  if (statedTotal === null || statedTotal < 0) return untouched;

  const difference = computedSum - statedTotal;
  const drift: DriftEvent | null =
    Math.abs(difference) > TOLERANCE_DOLLARS
      ? {
          statedTotal,
          computedSum,
          difference,
          categoryCount: breakdown.length,
          timestamp: now.toISOString(),
        }
      : null;

  // Corrected copy: total is exactly the category sum; category dollar
  // values are unchanged (only coerced to canonical numbers).
  const corrected: AnalysisResult = {
    ...report,
    totalLeakage: computedSum,
    leakageBreakdown: breakdown.map((category, i) => ({
      ...category,
      estimatedLeakage: values[i],
    })),
  };
  return { report: corrected, drift };
}
