/**
 * POST /api/flashcards/bulk-import
 *
 * Stages extracted flashcards as a DEck, optionally auto-derived from a lesson,
 * and stores the structured sections (front, back, high_yield, clinical_pearl,
 * memory_tip, references, difficulty, section).
 *
 * Only admins should be allowed to import in production. Students can use this
 * to save flashcards they authored themselves.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

type IncomingCard = {
  front: string;
  back: string;
  lesson_id?: string | null;
  section?: string | null;
  high_yield?: string | null;
  clinical_pearl?: string | null;
  memory_tip?: string | null;
  references?: string[];
  difficulty?: "easy" | "medium" | "hard" | null;
  image_url?: string | null;
  source?: string | null;
  tags?: string[];
  topic_id?: string | null;
};

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.cards)) {
    return NextResponse.json({ error: "cards[] is required" }, { status: 400 });
  }
  const cards = body.cards as IncomingCard[];
  const isAdmin = isAdminProfile(ctx.profile);
  const adminOnly = body.admin_only !== false;

  if (adminOnly && !isAdmin) {
    // Students can still create their own personal cards via /api/flashcards/manual
    return NextResponse.json({ error: "forbidden — admin only" }, { status: 403 });
  }

  const admin = createAdminClient();
  const rows = cards
    .filter((c) => c?.front?.trim() && c?.back?.trim())
    .map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
      lesson_id: c.lesson_id ?? null,
      topic_id: c.topic_id ?? null,
      tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
      image_url: c.image_url ?? null,
      ai_generated: typeof c.source === "string" && c.source.startsWith("ai"),
      created_by: ctx.user.id,
      section: c.section ?? null,
      high_yield: c.high_yield ?? null,
      clinical_pearl: c.clinical_pearl ?? null,
      memory_tip: c.memory_tip ?? null,
      references: Array.isArray(c.references) ? c.references.filter(Boolean) : [],
      difficulty: c.difficulty ?? "medium",
      source: c.source ?? null,
    }));

  if (!rows.length) return NextResponse.json({ inserted: 0 });
  const { data, error } = await admin.from("flashcards").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data?.length ?? 0 });
}
