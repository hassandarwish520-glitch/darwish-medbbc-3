/**
 * GET /api/flashcards/import-options
 * Returns visible courses and lessons so the student-side importer can
 * attach extracted flashcards to a real course/lesson rather than
 * dumping them into "General".
 */
import { NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: courses }, { data: lessons }] = await Promise.all([
    admin
      .from("courses")
      .select("id, title")
      .eq("visible", true)
      .order("created_at", { ascending: true }),
    admin
      .from("lessons")
      .select("id, title, course_id")
      .eq("visible", true)
      .order("position", { ascending: true }),
  ]);

  return NextResponse.json({
    courses: courses ?? [],
    lessons: lessons ?? [],
  });
}
