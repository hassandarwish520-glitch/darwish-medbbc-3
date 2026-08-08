import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";
import { normalizeQuestions } from "@/lib/question-normalizer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("quiz_sessions_ext")
    .select("id, mode, exam_code, subject_title, topic_title, question_count, question_ids, current_index, status, score_pct, seconds_elapsed, answers_json, created_at, completed_at")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .single();

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const questionIds = Array.isArray(session.question_ids) ? session.question_ids.filter(Boolean) : [];
  if (!questionIds.length) {
    return NextResponse.json({ session, questions: [] });
  }

  const { data: pool, error: questionError } = await admin
    .from("questions")
    .select("id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption, video_url")
    .in("id", questionIds);

  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });

  const normalized = normalizeQuestions((pool ?? []) as unknown[]);
  const byId = new Map(normalized.map((q: any) => [q.id, q]));
  const ordered = questionIds.map((qid) => byId.get(qid)).filter(Boolean);

  return NextResponse.json({ session, questions: ordered });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    status,
    current_index,
    answers_json,
    seconds_elapsed,
    score_pct,
  } = body as {
    status?: "active" | "suspended" | "complete";
    current_index?: number;
    answers_json?: Record<string, { chosen: string; correct: boolean }>;
    seconds_elapsed?: number;
    score_pct?: number;
  };

  const patch: Record<string, unknown> = {};
  if (status !== undefined) patch.status = status;
  if (current_index !== undefined) patch.current_index = current_index;
  if (answers_json !== undefined) patch.answers_json = answers_json;
  if (seconds_elapsed !== undefined) patch.seconds_elapsed = seconds_elapsed;
  if (score_pct !== undefined) patch.score_pct = score_pct;
  if (status === "complete") patch.completed_at = new Date().toISOString();

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quiz_sessions_ext")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
