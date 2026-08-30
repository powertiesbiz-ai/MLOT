import { GoogleGenAI, Chat, Content } from "@google/genai";
import { MLOT_SYSTEM_INSTRUCTION, ANALYSIS_GENERATION_PROMPT } from "../constants";
import { AnalysisResult } from "../types";

const MODEL_ID = "gemini-flash-latest";

let ai: GoogleGenAI | null = null;
let chatSession: Chat | null = null;

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

// Best-effort classification of an arbitrary thrown value (SDK errors, fetch
// failures, nested Google API error bodies) into a ChatErrorKind.
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

// Initialize the AI client
const getAI = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new ChatError("missing-key", "API key is not configured.");
    }
    try {
      ai = new GoogleGenAI({ apiKey });
    } catch (e) {
      throw new ChatError("init", "Failed to initialize the AI client.", e);
    }
  }
  return ai;
};

// Start a new diagnostic chat session
export const startDiagnosticChat = async (): Promise<Chat> => {
  try {
    const client = getAI();
    chatSession = client.chats.create({
      model: MODEL_ID,
      config: {
        systemInstruction: MLOT_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });
    return chatSession;
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError("init", "Failed to start the diagnostic session.", e);
  }
};

// Send a message and get a stream
export const sendMessageStream = async (message: string) => {
  if (!chatSession) {
    throw new ChatError("not-initialized", "Chat session is not initialized.");
  }
  try {
    return await chatSession.sendMessageStream({ message });
  } catch (e) {
    if (e instanceof ChatError) throw e;
    throw new ChatError(classify(e), "Failed to send message.", e);
  }
};

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

// Generate the final JSON report
export const generateAnalysisReport = async (chatHistory: Content[]): Promise<AnalysisResult> => {
  const client = getAI();
  
  // We construct a prompt that includes the history (or we could use the chat session, but a fresh generation call with context is often cleaner for strict JSON)
  // However, using the existing chat session is better to keep the "mindset" of the model.
  // But to force JSON, we might want to just pass the history as context to a new call or use the chat.
  
  // Let's use a new generation call to ensure clean JSON output without conversation artifacts.
  // We serialize the history into a transcript.
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
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: finalPrompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    jsonText = response.text || "{}";
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