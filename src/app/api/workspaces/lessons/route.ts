/**
 * GET /api/workspaces/lessons
 * Returns visible lessons that the user can attach a workspace to.
 * Each lesson is mapped to its likely note `category`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

function categorizeLesson(lesson: { kind: string; course_id: string | null; topic_id: string | null; title: string }): "subject" | "lecture" | "documents" | "qbank" {
  const k = (lesson.kind || "").toLowerCase();
  if (k === "qbank") return "qbank";
  if (k === "notes" || k === "html" || k === "pdf" || k === "html-file" || k === "html-inline") return "lecture";
  return "documents";
}

export async function GET(_req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lessons")
    .select("id, title, kind, course_id, topic_id, courses(id, title)")
    .eq("visible", true)
    .in("kind", ["html", "html-file", "html-inline", "pdf", "notes", "qbank"])
    .order("title")
    .limit(120);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lessons = (data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    title: l.title as string,
    kind: l.kind as string,
    course_id: (l.course_id as string | null) ?? null,
    course_title: ((l.courses as { title?: string | null } | null)?.title) ?? null,
    source_kind: categorizeLesson({
      kind: l.kind as string,
      course_id: (l.course_id as string | null) ?? null,
      topic_id: (l.topic_id as string | null) ?? null,
      title: l.title as string,
    }),
  }));

  return NextResponse.json({ lessons });
}
