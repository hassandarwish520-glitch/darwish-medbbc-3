/**
 * POST /api/flashcards/session-complete
 * Body: { started_at, ended_at, again, hard, good, easy, total, xp, duration_seconds }
 * Persists to flashcard_sessions so we can display "Yesterday" / "Today" history.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.total !== "number") {
    return NextResponse.json({ error: "total count is required" }, { status: 400 });
  }
  const s = await createClient();

  const row = {
    user_id: ctx.user.id,
    started_at: typeof body.started_at === "string" ? body.started_at : new Date().toISOString(),
    ended_at: typeof body.ended_at === "string" ? body.ended_at : new Date().toISOString(),
    again: Math.max(0, Number(body.again ?? 0)),
    hard: Math.max(0, Number(body.hard ?? 0)),
    good: Math.max(0, Number(body.good ?? 0)),
    easy: Math.max(0, Number(body.easy ?? 0)),
    total: Math.max(0, Number(body.total ?? 0)),
    xp: Math.max(0, Number(body.xp ?? 0)),
    duration_seconds: Math.max(0, Number(body.duration_seconds ?? 0)),
  };
  const { error } = await s.from("flashcard_sessions").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
