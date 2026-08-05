import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

// GET /api/quiz/sessions — list the current user's recent QBank sessions
export async function GET(_req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quiz_sessions_ext")
    .select("id, mode, exam_code, subject_title, question_count, question_ids, current_index, status, score_pct, seconds_elapsed, created_at, completed_at")
    .eq("user_id", ctx.user.id)
    .in("status", ["active", "suspended", "complete"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
