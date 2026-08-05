import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const {
    mode = "Tutor",
    exam_code = "IFOM_CSE",
    subject_title = null,
    topic_title = null,
    question_count = 20,
    question_ids = [],
  } = await req.json();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quiz_sessions_ext")
    .insert({
      user_id: ctx.user.id,
      mode,
      exam_code,
      subject_title,
      topic_title,
      question_count,
      question_ids,
      status: "active",
      meta: { configured_via: "api" },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
