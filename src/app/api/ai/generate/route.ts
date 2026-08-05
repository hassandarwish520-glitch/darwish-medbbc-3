// Admin-only: bulk generate questions or flashcards from a lesson.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { generateFlashcards, generateQuestions } from "@/lib/ai/tasks";
import { indexSource } from "@/lib/ai/rag";
import {
  extractFlashcardIndexText,
  extractLessonIndexText,
  extractQuestionIndexText,
} from "@/lib/ai/source-text";

export const runtime = "nodejs";
export const maxDuration = 120;

type LessonRow = {
  id: string;
  kind: string;
  html_body?: string | null;
  storage_path?: string | null;
  meta?: Record<string, unknown> | null;
};

async function extractLessonText(lesson: LessonRow, admin: ReturnType<typeof createAdminClient>): Promise<string> {
  if (lesson.kind === "html" && lesson.html_body) {
    return extractLessonIndexText(lesson);
  }

  if (lesson.storage_path) {
    const { data } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
    if (!data) return extractLessonIndexText(lesson);
    if (lesson.kind === "html") return extractLessonIndexText(lesson, await data.text());
  }

  return extractLessonIndexText(lesson);
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { lesson_id, mode, count = 5, difficulty = "intermediate" } = await req.json();
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", lesson_id).single();
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const text = await extractLessonText(lesson, admin);
  if (!text.trim()) {
    return NextResponse.json(
      { error: "no text extractable; add HTML content or RAG text/notes for PDF/video lessons" },
      { status: 400 }
    );
  }

  try {
    if (mode === "questions") {
      const items = await generateQuestions(text, count, difficulty);
      if (!items.length) return NextResponse.json({ error: "AI returned nothing" }, { status: 500 });

      const rows = items.map((q: { stem: string; choices: unknown; answer_key: string; explanation?: string; difficulty?: string; tags?: string[] }) => ({
        lesson_id,
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        difficulty: q.difficulty || difficulty,
        tags: q.tags ?? [],
        ai_generated: true,
        created_by: ctx.user.id,
      }));

      const { data: inserted, error } = await admin.from("questions").insert(rows).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await Promise.all(
        (inserted ?? []).map(async (row) => {
          const indexText = extractQuestionIndexText(row);
          if (indexText) await indexSource("question", row.id, indexText);
        })
      );

      return NextResponse.json({ inserted: inserted?.length ?? rows.length });
    }

    if (mode === "flashcards") {
      // Flashcard generation via AI is disabled. Use /api/flashcards/ai-generate instead,
      // which extracts real flashcards directly from the source document text.
      return NextResponse.json(
        { error: "AI flashcard generation is disabled. Use the 'Extract Flashcards' action in the Flashcards admin to extract real content from your document." },
        { status: 410 }
      );
    }

    if (mode === "index") {
      const result = await indexSource("lesson", lesson.id, text);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
