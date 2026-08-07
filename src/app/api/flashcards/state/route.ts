/**
 * GET  /api/flashcards/state?deck_id=…&lesson_id=…
 *   Returns per-card aggregate state (bookmark, incorrect_count, streak, last seen)
 *   for the current user.
 * POST /api/flashcards/state
 *   Body: { flashcard_id, bookmark? , incorrect_count? , streak_correct? , last_seen_at? }
 *   Upserts flashcard_state row.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await createClient();
  const params = req.nextUrl.searchParams;
  const lessonId = params.get("lesson_id");
  const flashcardId = params.get("flashcard_id");

  let query = s.from("flashcard_state").select("*").eq("user_id", ctx.user.id);
  if (flashcardId) query = query.eq("flashcard_id", flashcardId);
  if (lessonId) {
    // join-based filter: flashcard_state -> flashcards -> lesson_id
    query = query.contains("data", { lesson_id: lessonId }) as typeof query;
  }
  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ states: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.flashcard_id !== "string") {
    return NextResponse.json({ error: "flashcard_id is required" }, { status: 400 });
  }
  const s = await createClient();

  const existing = await s.from("flashcard_state")
    .select("*").eq("user_id", ctx.user.id).eq("flashcard_id", body.flashcard_id).maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });

  const patch = {
    user_id: ctx.user.id,
    flashcard_id: body.flashcard_id,
    bookmarked: typeof body.bookmarked === "boolean"
      ? body.bookmarked
      : existing.data?.bookmarked ?? false,
    incorrect_count: typeof body.incorrect_count === "number"
      ? body.incorrect_count
      : existing.data?.incorrect_count ?? 0,
    streak_correct: typeof body.streak_correct === "number"
      ? body.streak_correct
      : existing.data?.streak_correct ?? 0,
    last_seen_at: body.last_seen_at ?? new Date().toISOString(),
  };
  const up = await s.from("flashcard_state").upsert(patch, { onConflict: "user_id,flashcard_id" });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
