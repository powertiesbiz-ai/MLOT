import type { Content } from "@google/genai";
import {
  MLOT_SYSTEM_INSTRUCTION,
  ANALYSIS_GENERATION_PROMPT,
  INITIAL_GREETING,
} from "../constants";
import { AnalysisResult } from "../types";

/**
 * The Gemini API key is NOT in this bundle. All model calls go through the
 * server-side proxy routes (/api/mlot-chat, /api/mlot-report), which read
 * GEMINI_API_KEY from the server environment at runtime — the same pattern
 * Warrior 25 uses. The client keeps the conversation history and sends it
 * with each request because the server is stateless.
 */

/**
 * The distinct failure modes the UI needs to tell apart. Everything the service
 * throws is a ChatError carrying one of these, so the UI never has to guess.
 */
export type ChatErrorKind =
  | "missing-key"      // no API key configured
  | "init"             // client / chat session failed to initialize
  | "not-initialized"  // a message was sent before the session was ready
  | "quota"            // 429 / RESOURCE_EXHAUSTED / billing limit
  | "network"          // could not reach the server
  | "unknown";         // anything else

export class ChatError extends Error {
  readonly kind: ChatErrorKind;
  constructor(kind: ChatErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ChatError";
    this.kind = kind;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

// Best-effort classification of an arbitrary thrown value (server errors,
// fetch failures, nested Google API error bodies) into a ChatErrorKind.
const classify = (err: unknown): ChatErrorKind => {
  if (err instanceof ChatError) return err.kind;

  const parts: string[] = [];
  const visit = (value: unknown, depth: number) => {
    if (!value || depth > 4) return;
    if (typeof value === "string") { parts.push(value); return; }
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (typeof o.message === "string") parts.push(o.message);
      if (typeof o.status === "string") parts.push(o.status);
      if (o.code !== undefined) parts.push(String(o.code));
      visit(o.error, depth + 1);
      visit(o.cause, depth + 1);
    }
  };
  visit(err, 0);
  const haystack = parts.join(" ").toLowerCase();

  if (
    haystack.includes("api key not valid") ||
    haystack.includes("api_key_invalid") ||
    haystack.includes("permission_denied") ||
    haystack.includes("api key missing") ||
    haystack.includes("api_key missing")
  ) return "missing-key";

  if (
    haystack.includes("429") ||
    haystack.includes("quota") ||
    haystack.includes("resource_exhausted") ||
    haystack.includes("billing") ||
    haystack.includes("credits")
  ) return "quota";

  if (
    err instanceof TypeError ||
    haystack.includes("failed to fetch") ||
    haystack.includes("networkerror") ||
    haystack.includes("network error") ||
    haystack.includes("err_network") ||
    haystack.includes("load failed")
  ) return "network";

  return "unknown";
};

/**
 * Single source of truth for user-facing error copy. Plain text, no markdown.
 * Pass any caught value (ChatError or raw) from the diagnostic flow.
 */
export const chatErrorMessage = (err: unknown): string => {
  switch (classify(err)) {
    case "missing-key":
      return "The diagnostic can't run because the API key is missing or invalid. Set a valid GEMINI_API_KEY and reload the page.";
    case "init":
      return "Something went wrong starting the diagnostic. Please check your setup and try again.";
    case "not-initialized":
      return "The diagnostic session isn't ready yet. Please reload the page and start again.";
    case "quota":
      return "The service is temporarily unavailable because a usage or billing limit was reached. Please wait a few minutes, or check the plan and billing details, then try again.";
    case "network":
      return "Couldn't reach the server. Check your internet connection and try again.";
    default:
      return "Something went wrong while processing your request. Please try again.";
  }
};

// Conversation history sent with each request (the server is stateless).
let serverHistory: Content[] = [];

// Start a new diagnostic chat session. Verifies the server route is up and
// the API key is configured before the UI shows the greeting.
export const startDiagnosticChat = async (): Promise<void> => {
  serverHistory = [{ role: "model", parts: [{ text: INITIAL_GREETING }] }];
  let health: { ok?: boolean; keyConfigured?: boolean } = {};
  try {
    const res = await fetch("/api/mlot-chat", { method: "GET" });
    health = (await res.json()) as typeof health;
  } catch (e) {
    throw new ChatError("init", "Failed to start the diagnostic session.", e);
  }
  if (!health.keyConfigured) {
    throw new ChatError(
      "missing-key",
      "API key is not configured on the server."
    );
  }
};

// Send a message and stream the reply. Yields { text } chunks so the UI's
// existing `for await (const chunk of stream)` loop keeps working unchanged.
export async function* sendMessageStream(
  message: string
): AsyncGenerator<{ text: string }> {
  let res: Response;
  try {
    res = await fetch("/api/mlot-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: MLOT_SYSTEM_INSTRUCTION,
        history: serverHistory,
        message,
      }),
    });
  } catch (e) {
    throw new ChatError("network", "Failed to send message.", e);
  }

  if (!res.ok) {
    let kind: ChatErrorKind = "unknown";
    try {
      const data = await res.json();
      kind = classify((data as any)?.error ?? `HTTP ${res.status}`);
    } catch {
      /* keep unknown */
    }
    throw new ChatError(kind, `Failed to send message (HTTP ${res.status}).`);
  }
  if (!res.body) {
    throw new ChatError(
      "network",
      "Failed to send message: empty response body."
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  let streamDone = false;
  try {
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith("data:")) continue;
        let data: any;
        try {
          data = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (data.error)
          throw new ChatError(classify(data.error), "Failed to send message.");
        if (typeof data.text === "string" && data.text) {
          fullResponse += data.text;
          yield { text: data.text };
        }
        if (data.done) {
          streamDone = true;
          break;
        }
      }
    }
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError(classify(e), "Failed to send message.", e);
  } finally {
    reader.releaseLock();
  }

  serverHistory.push({ role: "user", parts: [{ text: message }] });
  serverHistory.push({ role: "model", parts: [{ text: fullResponse }] });
}

// Parse a value that should be a number but may arrive as "$6,400,000" etc.
const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

// Format a dollar amount identically to the dashboard / report views.
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

// Force the report to be internally consistent so the dashboard, report modal,
// and Word export all render the same figures:
//  - each category's estimatedLeakage is coerced to a real number
//  - totalLeakage becomes the exact sum of the category breakdown
//  - the executive summary ends by citing that same authoritative total
const reconcileAnalysis = (report: AnalysisResult): AnalysisResult => {
  const breakdown = Array.isArray(report.leakageBreakdown) ? report.leakageBreakdown : [];
  breakdown.forEach((category) => {
    if (category) category.estimatedLeakage = toNumber(category.estimatedLeakage);
  });

  const summed = breakdown.reduce((total, category) => total + (category?.estimatedLeakage || 0), 0);
  report.leakageBreakdown = breakdown;
  report.totalLeakage = summed > 0 ? summed : toNumber(report.totalLeakage);

  const totalText = formatCurrency(report.totalLeakage);
  const summary = (report.executiveSummary || "").trim();
  report.executiveSummary = summary
    ? `${summary}${/[.!?]$/.test(summary) ? "" : "."} Across all categories, the total estimated annual leakage is ${totalText}.`
    : `The total estimated annual leakage across all categories is ${totalText}.`;

  return report;
};

// Generate the final JSON report via the server-side proxy.
export const generateAnalysisReport = async (chatHistory: Content[]): Promise<AnalysisResult> => {
  const transcript = chatHistory.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'MLOT Analyzer';
    const text = msg.parts[0].text;
    return `${role}: ${text}`;
  }).join('\n\n');

  const finalPrompt = `
  TRANSCRIPT OF DIAGNOSTIC INTERVIEW:
  ${transcript}

  ${ANALYSIS_GENERATION_PROMPT}
  `;

  let jsonText: string;
  try {
    const res = await fetch("/api/mlot-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: finalPrompt }),
    });
    if (!res.ok) {
      let kind: ChatErrorKind = "unknown";
      try {
        const data = await res.json();
        kind = classify((data as any)?.error ?? `HTTP ${res.status}`);
      } catch {
        /* keep unknown */
      }
      throw new ChatError(kind, "Failed to generate the analysis report.");
    }
    const data = (await res.json()) as { text?: string };
    jsonText = data.text || "{}";
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError(classify(e), "Failed to generate the analysis report.", e);
  }

  try {
    const parsed = JSON.parse(jsonText) as AnalysisResult;
    return reconcileAnalysis(parsed);
  } catch (e) {
    console.error("Failed to parse JSON report", e);
    throw new ChatError("unknown", "The analysis report could not be generated. Please try again.", e);
  }
};
