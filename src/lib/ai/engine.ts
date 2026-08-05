/**
 * AI Engine — multi-provider with automatic fallback.
 * Priority: Groq → Cloudflare Workers AI → HuggingFace → generic OpenAI-compat → local
 * No API keys are required from the user — all keys come from environment variables.
 */
import crypto from "node:crypto";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const EMBED_DIM = 1536;

// ─── Provider detection ──────────────────────────────────────────────────────

function detectProvider(): "groq" | "cloudflare" | "huggingface" | "openai" | "none" {
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) return "cloudflare";
  if (process.env.HUGGINGFACE_TOKEN?.trim()) return "huggingface";
  if (process.env.AI_API_KEY?.trim()) return "openai";
  return "none";
}

export const AI_ENABLED = detectProvider() !== "none";

// ─── Local fallback embedding (no external API needed) ───────────────────────

function tokenize(input: string) {
  return input.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).map(t => t.trim()).filter(Boolean);
}

function localEmbedding(input: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(input);
  const parts = tokens.length ? tokens : input.split("").filter(Boolean);
  for (const token of parts) {
    const digest = crypto.createHash("sha256").update(token).digest();
    const idx = digest.readUInt16BE(0) % EMBED_DIM;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    const weight = 1 + (digest[3] % 5) / 5;
    vec[idx] += sign * weight;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => Number((v / norm).toFixed(6)));
}

// ─── Groq (OpenAI-compatible) ─────────────────────────────────────────────────

async function groqChat(messages: ChatMsg[], opts: { temperature?: number; json?: boolean }): Promise<string> {
  const model = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const data = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Cloudflare Workers AI ────────────────────────────────────────────────────

async function cloudflareChat(messages: ChatMsg[]): Promise<string> {
  const model = process.env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${await r.text()}`);
  const data = await r.json() as { result?: { response?: string } };
  return data.result?.response ?? "";
}

// ─── HuggingFace Inference API ────────────────────────────────────────────────

async function huggingfaceChat(messages: ChatMsg[]): Promise<string> {
  const model = process.env.HUGGINGFACE_MODEL || "mistralai/Mistral-7B-Instruct-v0.3";
  const prompt = messages.map(m => `${m.role === "user" ? "[INST]" : ""}${m.content}${m.role === "user" ? "[/INST]" : ""}`).join("\n");
  const r = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.HUGGINGFACE_TOKEN}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1024, temperature: 0.3 } }),
  });
  if (!r.ok) throw new Error(`HuggingFace ${r.status}: ${await r.text()}`);
  const data = await r.json() as Array<{ generated_text?: string }>;
  const raw = data[0]?.generated_text ?? "";
  return raw.slice(prompt.length).trim();
}

// ─── Generic OpenAI-compatible ────────────────────────────────────────────────

async function openaiChat(messages: ChatMsg[], opts: { temperature?: number; json?: boolean }): Promise<string> {
  const base = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.AI_CHAT_MODEL || "gpt-4o-mini";
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`OpenAI-compat ${r.status}: ${await r.text()}`);
  const data = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function chat(messages: ChatMsg[], opts: { temperature?: number; json?: boolean } = {}): Promise<string> {
  const provider = detectProvider();
  try {
    if (provider === "groq") return await groqChat(messages, opts);
    if (provider === "cloudflare") return await cloudflareChat(messages);
    if (provider === "huggingface") return await huggingfaceChat(messages);
    if (provider === "openai") return await openaiChat(messages, opts);
  } catch (err) {
    // If primary provider fails, return empty so callers fall back gracefully
    console.warn(`[AI] provider=${provider} failed:`, err instanceof Error ? err.message : err);
  }
  return "";
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  // For Groq/Cloudflare/HuggingFace we use local embeddings (they don't have embedding APIs)
  // Only use remote embeddings when OpenAI-compat provider with embed model is configured
  if (detectProvider() === "openai" && process.env.AI_EMBED_MODEL?.trim()) {
    try {
      const base = process.env.AI_BASE_URL || "https://api.openai.com/v1";
      const r = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({ model: process.env.AI_EMBED_MODEL, input: texts }),
      });
      if (r.ok) {
        const data = await r.json() as { data: Array<{ embedding: number[] }> };
        return data.data.map(item => item.embedding);
      }
    } catch { /* fall through to local */ }
  }
  return texts.map(t => localEmbedding(t));
}

export const TUTOR_SYSTEM = `You are Darwish MedBBC's medical tutor.
- Teach step-by-step and stay clinically accurate.
- Prefer the provided course context and cite it as [[n]].
- Never fabricate references or facts.
- If context is insufficient, say that clearly.
- Keep answers concise, practical, and MBBS/USMLE-oriented.`;
