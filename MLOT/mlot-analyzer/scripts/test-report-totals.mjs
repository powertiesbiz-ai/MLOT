#!/usr/bin/env node
/**
 * Standalone test for services/reportTotals.ts (normalizeReportTotals).
 * Not part of the app bundle — run manually:
 *   node scripts/test-report-totals.mjs
 * It bundles the TS module with the app's esbuild into a temp file and
 * exercises it with synthetic AnalysisResult objects.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(mkdtempSync(join(tmpdir(), "report-totals-")), "reportTotals.mjs");
execFileSync(
  join(appDir, "node_modules", ".bin", "esbuild"),
  [
    join(appDir, "services", "reportTotals.ts"),
    "--bundle",
    "--format=esm",
    `--outfile=${out}`,
  ],
  { stdio: "inherit" }
);
const { normalizeReportTotals } = await import(pathToFileURL(out).href);

const cat = (category, estimatedLeakage) => ({
  category,
  estimatedLeakage,
  description: "",
  priority: "High",
});
const base = (totalLeakage, leakageBreakdown) => ({
  totalLeakage,
  leakageBreakdown,
  topPriorities: [],
  recommendations: { leadership: [], process: [], marketing: [], collections: [] },
  executiveSummary: "Synthetic test report.",
});

const NOW = new Date("2026-10-20T16:30:00.000Z");
let passed = 0;
let failed = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} ${detail}`);
  }
};

// 1. Drift: stated $210,000 vs categories summing to $195,000 → corrected + event.
{
  const input = base(210000, [cat("A", 60000), cat("B", 45000), cat("C", 90000)]);
  const { report, drift } = normalizeReportTotals(input, NOW);
  check("drift: total corrected to category sum", report.totalLeakage === 195000, `got ${report.totalLeakage}`);
  check("drift: event produced", drift !== null);
  check(
    "drift: event figures",
    drift &&
      drift.statedTotal === 210000 &&
      drift.computedSum === 195000 &&
      drift.difference === -15000 &&
      drift.categoryCount === 3 &&
      drift.timestamp === NOW.toISOString(),
    JSON.stringify(drift)
  );
  check("drift: categories unaltered", report.leakageBreakdown.map((c) => c.estimatedLeakage).join(",") === "60000,45000,90000");
  check("drift: input object not mutated", input.totalLeakage === 210000);
}

// 2. Matching figures → no correction, no event.
{
  const { report, drift } = normalizeReportTotals(
    base(195000, [cat("A", 60000), cat("B", 45000), cat("C", 90000)]),
    NOW
  );
  check("match: total unchanged", report.totalLeakage === 195000);
  check("match: no event", drift === null);
}

// 3. Within $1 rounding tolerance → silently normalized, no event.
{
  const { report, drift } = normalizeReportTotals(
    base(195001, [cat("A", 60000), cat("B", 45000), cat("C", 90000)]),
    NOW
  );
  check("tolerance: total normalized to exact sum", report.totalLeakage === 195000, `got ${report.totalLeakage}`);
  check("tolerance: no event", drift === null);
}

// 4. String-formatted figures ("$210,000") parse and correct the same way.
{
  const { report, drift } = normalizeReportTotals(
    base("$210,000", [cat("A", "$60,000"), cat("B", "$45,000"), cat("C", "$90,000")]),
    NOW
  );
  check("strings: total corrected", report.totalLeakage === 195000, `got ${report.totalLeakage}`);
  check("strings: event stated total parsed", drift && drift.statedTotal === 210000, JSON.stringify(drift));
  check("strings: categories coerced to numbers", report.leakageBreakdown.every((c) => typeof c.estimatedLeakage === "number"));
}

// 5. Unparseable category figure → report untouched, no event (never guess).
{
  const input = base(210000, [cat("A", 60000), cat("B", "TBD")]);
  const { report, drift } = normalizeReportTotals(input, NOW);
  check("unparseable: total untouched", report.totalLeakage === 210000);
  check("unparseable: category untouched", report.leakageBreakdown[1].estimatedLeakage === "TBD");
  check("unparseable: no event", drift === null);
}

// 6. Empty breakdown → no check, no event.
{
  const { report, drift } = normalizeReportTotals(base(50000, []), NOW);
  check("empty: total untouched", report.totalLeakage === 50000);
  check("empty: no event", drift === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
