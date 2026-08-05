import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, title, course_id, kind")
    .eq("id", id)
    .single();

  if (lessonError || !lesson)
    return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const { data: questions, error: qError } = await admin
    .from("questions")
    .select(
      "id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption, video_url, created_at"
    )
    .eq("lesson_id", id)
    .order("created_at", { ascending: true });

  if (qError)
    return NextResponse.json({ error: qError.message }, { status: 500 });

  return NextResponse.json({ lesson, questions: questions ?? [] });
}
