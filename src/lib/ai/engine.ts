// Shared AI Engine — one wrapper for all modules (Tutor, QGen, Flashcards, RAG).
// OpenAI-compatible API (works with OpenAI, OpenRouter, DeepSeek, Together, Groq, ...).

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const BASE = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const KEY  = process.env.AI_API_KEY  || "";
const CHAT_MODEL  = process.env.AI_CHAT_MODEL  || "gpt-4o-mini";
const EMBED_MODEL = process.env.AI_EMBED_MODEL || "text-embedding-3-small";

async function post<T>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI ${path} ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function chat(messages: ChatMsg[], opts: { temperature?: number; json?: boolean } = {}) {
  const res = await post<any>("/chat/completions", {
    model: CHAT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });
  return res.choices?.[0]?.message?.content ?? "";
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await post<any>("/embeddings", { model: EMBED_MODEL, input: texts });
  return res.data.map((d: any) => d.embedding as number[]);
}

// Consistent system prompt across every AI feature.
export const TUTOR_SYSTEM = `You are Darwish MedBBC's medical tutor.
- Teach step-by-step; never just give the final answer.
- Cite lesson passages when provided in CONTEXT.
- If unsure, say so. Never fabricate references.
- Keep answers concise, clinical, and USMLE/MBBS accurate.`;
