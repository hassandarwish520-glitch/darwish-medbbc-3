import type { SupabaseClient } from "@supabase/supabase-js";

type InsertableFlashcard = {
  front: string;
  back: string;
  lesson_id?: string | null;
  topic_id?: string | null;
  tags?: string[];
  image_url?: string | null;
  ai_generated?: boolean;
  created_by?: string | null;
  section?: string | null;
  high_yield?: string | null;
  clinical_pearl?: string | null;
  memory_tip?: string | null;
  references?: string[];
  difficulty?: string | null;
  source?: string | null;
};

const OPTIONAL_COLUMNS = [
  "section",
  "high_yield",
  "clinical_pearl",
  "memory_tip",
  "references",
  "difficulty",
  "source",
  "image_url",
  "topic_id",
] as const;

function stripOptional(row: InsertableFlashcard) {
  const clone: Record<string, unknown> = { ...row };
  for (const key of OPTIONAL_COLUMNS) delete clone[key];
  return clone;
}

function looksLikeSchemaCacheColumnError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find the") ||
    m.includes("column") ||
    m.includes("pgrst")
  );
}

export async function insertFlashcardsCompat(
  admin: SupabaseClient,
  rows: InsertableFlashcard[],
) {
  let res = await admin.from("flashcards").insert(rows).select("id");
  if (!res.error) return { data: res.data ?? [], mode: "rich" as const };

  if (!looksLikeSchemaCacheColumnError(res.error.message)) {
    return { data: null, error: res.error, mode: "rich" as const };
  }

  const fallbackRows = rows.map(stripOptional);
  res = await admin.from("flashcards").insert(fallbackRows).select("id");
  if (!res.error) return { data: res.data ?? [], mode: "fallback" as const };

  return { data: null, error: res.error, mode: "fallback" as const };
}
