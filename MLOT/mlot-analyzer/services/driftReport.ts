import type { DriftEvent } from "./reportTotals";

// Drift reporter — fires once when the report-total check (reportTotals.ts)
// corrects a headline total that disagreed with its own category breakdown,
// so Keith hears about the drift and the fix by email (via the n8n
// "MLOT Drift Report" workflow).
// Payload is ONLY the app slug, the gate token, and the figures — no business
// name, no user identity, no report content ever leave the browser in this
// call (same rule as the usage counter in usagePing.ts).
// Reporting must never break the app: every failure is swallowed.
const DRIFT_URL = "https://n8n.powerties.us/webhook/mlot-drift-report";
const DRIFT_TOKEN = "eed6cef3a6a805f7e74569404bc9f29de3b4bca629be4a82";

export function reportDrift(event: DriftEvent): void {
  try {
    const payload = JSON.stringify({
      app: "mlot",
      token: DRIFT_TOKEN,
      statedTotal: event.statedTotal,
      computedSum: event.computedSum,
      difference: event.difference,
      categoryCount: event.categoryCount,
      timestamp: event.timestamp,
    });
    // text/plain keeps the request CORS-safelisted (no preflight) for beacons.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(DRIFT_URL, blob)) return;
    }
    void fetch(DRIFT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: payload,
      keepalive: true,
      mode: "no-cors",
    }).catch(() => undefined);
  } catch {
    // Never surface reporting errors to the user.
  }
}
