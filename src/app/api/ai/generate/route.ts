// Admin-only: bulk generate questions or flashcards from a lesson.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";
import { generateQuestions, generateFlashcards } from "@/lib/ai/tasks";
import { indexSource } from "@/lib/ai/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

async function extractLessonText(lesson: any, admin: any): Promise<string> {
  if (lesson.kind === "html" && lesson.html_body) return lesson.html_body.replace(/<[^>]+>/g, " ");
  if (lesson.storage_path) {
    const { data } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
    if (!data) return "";
    if (lesson.kind === "html") return (await data.text()).replace(/<[^>]+>/g, " ");
    // pdf: skip text extract on server for now — indexing done from html/inline text.
  }
  return "";
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { lesson_id, mode, count = 5, difficulty = "intermediate" } = await req.json();
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", lesson_id).single();
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const text = await extractLessonText(lesson, admin);
  if (!text.trim()) return NextResponse.json({ error: "no text extractable" }, { status: 400 });

  try {
    if (mode === "questions") {
      const items = await generateQuestions(text, count, difficulty);
      if (!items.length) return NextResponse.json({ error: "AI returned nothing" }, { status: 500 });
      const rows = items.map((q: any) => ({
        lesson_id, stem: q.stem, choices: q.choices, answer_key: q.answer_key,
        explanation: q.explanation, difficulty: q.difficulty || difficulty,
        tags: q.tags ?? [], ai_generated: true, created_by: ctx.user.id,
      }));
      const { error } = await admin.from("questions").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ inserted: rows.length });
    }
    if (mode === "flashcards") {
      const items = await generateFlashcards(text, count);
      if (!items.length) return NextResponse.json({ error: "AI returned nothing" }, { status: 500 });
      const rows = items.map((f: any) => ({
        lesson_id, front: f.front, back: f.back, tags: f.tags ?? [],
        ai_generated: true, created_by: ctx.user.id,
      }));
      const { error } = await admin.from("flashcards").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ inserted: rows.length });
    }
    if (mode === "index") {
      const r = await indexSource("lesson", lesson.id, text);
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
