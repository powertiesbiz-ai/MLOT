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
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON report", e);
    throw new Error("Analysis generation failed");
  }
};