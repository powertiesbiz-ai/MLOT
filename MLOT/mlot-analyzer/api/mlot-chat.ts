/**
 * Vercel serverless function: POST /api/mlot-chat (GET = health check)
 *
 * Proxies the MLOT diagnostic chat to Gemini. The API key lives ONLY here,
 * read from process.env.GEMINI_API_KEY at runtime — it never reaches the
 * client bundle. Same pattern as Warrior 25's api/coach.ts.
 *
 * POST body: { systemInstruction?: string, history?: Content[], message: string }
 * Streams Server-Sent Events:
 *   data: {"text":"..."} ... data: {"done":true}
 * On error mid-stream:
 *   data: {"error":"..."}
 */

// Minimal request/response shapes so we don't need the @vercel/node package.
interface VercelReq {
  method?: string;
  body?: any;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
}

import { GoogleGenAI } from "@google/genai";

const MODEL_ID = "gemini-2.5-flash";

export default async function handler(req: VercelReq, res: VercelRes) {
  // Health check: lets the client verify the route is up and the key exists.
  if (req.method === "GET") {
    res
      .status(200)
      .json({ ok: true, keyConfigured: Boolean(process.env.GEMINI_API_KEY) });
    return;
  }
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

  const body = req.body ?? {};
  const { systemInstruction, history, message } = body;
  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Missing message" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (data: unknown) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: MODEL_ID,
      config: {
        ...(typeof systemInstruction === "string" && systemInstruction
          ? { systemInstruction }
          : {}),
        temperature: 0.7,
      },
      history: Array.isArray(history) ? history : [],
    });
    const stream = await chat.sendMessageStream({ message });
    for await (const chunk of stream) {
      const text = (chunk as { text?: string }).text;
      if (text) send({ text });
    }
    send({ done: true });
    res.end();
  } catch (e: any) {
    send({ error: e?.message ?? String(e) });
    res.end();
  }
}
