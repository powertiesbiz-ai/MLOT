/**
 * Vercel serverless function: POST /api/mlot-report
 *
 * Generates the final MLOT JSON analysis report server-side. The API key
 * lives ONLY here, read from process.env.GEMINI_API_KEY at runtime.
 *
 * POST body: { prompt: string }
 * Response: { text: string } (raw JSON string for the client to parse)
 */

interface VercelReq {
  method?: string;
  body?: any;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
}

import { GoogleGenAI } from "@google/genai";

const MODEL_ID = "gemini-2.5-flash";

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res
      .status(500)
      .json({ error: "Server misconfigured: GEMINI_API_KEY is not set" });
    return;
  }

  const { prompt } = req.body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    res.status(200).json({ text: response.text ?? "{}" });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
