import { NextRequest, NextResponse } from "next/server";
import { requireActive, createClient } from "@/lib/supabase/server";

// SM-2 spaced-repetition algorithm.
function sm2(ease: number, interval: number, reps: number, grade: number) {
  let e = ease, r = reps, ivl = interval;
  if (grade < 3) { r = 0; ivl = 1; }
  else {
    r += 1;
    ivl = r === 1 ? 1 : r === 2 ? 6 : Math.round(ivl * e);
    e = Math.max(1.3, e + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
  return { ease: e, interval_days: ivl, repetitions: r };
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { flashcard_id, grade } = await req.json();
  const s = createClient();

  const { data: existing } = await s.from("flashcard_reviews").select("*")
    .eq("user_id", ctx.user.id).eq("flashcard_id", flashcard_id).maybeSingle();

  const base = existing ?? { ease: 2.5, interval_days: 0, repetitions: 0 };
  const next = sm2(base.ease, base.interval_days, base.repetitions, grade);
  const due = new Date(Date.now() + next.interval_days * 24 * 60 * 60 * 1000).toISOString();

  const row = {
    user_id: ctx.user.id, flashcard_id, ...next,
    due_at: due, last_grade: grade, updated_at: new Date().toISOString(),
  };
  const { error } = await s.from("flashcard_reviews").upsert(row, { onConflict: "user_id,flashcard_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, next });
}
