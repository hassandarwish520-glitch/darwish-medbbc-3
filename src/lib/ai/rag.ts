import { createAdminClient } from "@/lib/supabase/server";
import { embed } from "./engine";
import crypto from "node:crypto";

const CHUNK = 1200, OVERLAP = 150;

export function chunkText(input: string): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK - OVERLAP) {
    out.push(text.slice(i, i + CHUNK));
    if (i + CHUNK >= text.length) break;
  }
  return out;
}

const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

export async function indexSource(source_type: string, source_id: string, text: string) {
  const supabase = createAdminClient();
  const chunks = chunkText(text);
  if (!chunks.length) return { indexed: 0 };

  // Skip chunks already embedded (cache by hash).
  const hashes = chunks.map(hash);
  const { data: existing } = await supabase
    .from("rag_chunks").select("content_hash")
    .eq("source_type", source_type).eq("source_id", source_id).in("content_hash", hashes);
  const known = new Set((existing ?? []).map((r: any) => r.content_hash));

  const fresh = chunks.map((c, i) => ({ c, h: hashes[i] })).filter(({ h }) => !known.has(h));
  if (!fresh.length) return { indexed: 0, cached: chunks.length };

  const vectors = await embed(fresh.map(f => f.c));
  const rows = fresh.map((f, i) => ({
    source_type, source_id, content: f.c, content_hash: f.h, embedding: vectors[i] as any,
  }));
  const { error } = await supabase.from("rag_chunks").upsert(rows, {
    onConflict: "source_type,source_id,content_hash",
  });
  if (error) throw error;
  return { indexed: rows.length };
}

export async function retrieve(query: string, k = 6) {
  const [qv] = await embed([query]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding: qv as any, match_count: k,
  });
  if (error) throw error;
  return (data ?? []) as { id: string; source_type: string; source_id: string; content: string; similarity: number }[];
}
