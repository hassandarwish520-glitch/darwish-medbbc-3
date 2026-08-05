import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

// PATCH /api/quiz/sessions/[id] — update session state (suspend / complete / progress)
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
    .eq("user_id", ctx.user.id) // security: only own sessions
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
