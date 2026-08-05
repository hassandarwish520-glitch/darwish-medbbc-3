import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Get all lessons that have at least one question, with question counts
  const { data, error } = await admin
    .from("lessons")
    .select(`
      id,
      title,
      kind,
      created_at,
      course_id,
      questions!questions_lesson_id_fkey(count)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter to only lessons with questions and shape the response
  const collections = (data ?? [])
    .map((lesson: any) => ({
      id: lesson.id,
      title: lesson.title,
      kind: lesson.kind,
      course_id: lesson.course_id,
      question_count: (lesson.questions as any)?.[0]?.count ?? 0,
      created_at: lesson.created_at,
    }))
    .filter((c) => c.question_count > 0);

  return NextResponse.json({ collections });
}
