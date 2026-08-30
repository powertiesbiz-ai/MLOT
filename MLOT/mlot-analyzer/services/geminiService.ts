import { GoogleGenAI, ChatSession, Content, GenerativeModel } from "@google/genai";
import { MLOT_SYSTEM_INSTRUCTION, ANALYSIS_GENERATION_PROMPT } from "../constants";
import { AnalysisResult } from "../types";

let ai: GoogleGenAI | null = null;
let model: GenerativeModel | null = null;
let chatSession: ChatSession | null = null;

// Initialize the AI client
const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API_KEY is missing from environment variables.");
      throw new Error("API Key missing");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Start a new diagnostic chat session
export const startDiagnosticChat = async (): Promise<ChatSession> => {
  const client = getAI();
  chatSession = client.chats.create({
    model: 'gemini-flash-latest',
    config: {
      systemInstruction: MLOT_SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
  });
  return chatSession;
};

// Send a message and get a stream
export const sendMessageStream = async (message: string) => {
  if (!chatSession) throw new Error("Chat session not initialized");
  return await chatSession.sendMessageStream({ message });
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

  const response = await client.models.generateContent({
    model: 'gemini-flash-latest',
    contents: finalPrompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  const jsonText = response.text || "{}";
  try {
    const parsed = JSON.parse(jsonText) as AnalysisResult;
    return reconcileAnalysis(parsed);
  } catch (e) {
    console.error("Failed to parse JSON report", e);
    throw new Error("Analysis generation failed");
  }
};