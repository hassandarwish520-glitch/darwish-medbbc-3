/**
 * Question extraction from source document.
 * Extracts questions directly from the lesson text using regex patterns.
 * AI is used only if available and the regex extraction yields nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { extractQuestionsFromImportedSource } from "@/lib/ai/question-import";
import { extractLessonIndexText } from "@/lib/ai/source-text";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";
import { indexSource } from "@/lib/ai/rag";
import { extractQuestionIndexText } from "@/lib/ai/source-text";
import { detectIfomSubject, detectTopic } from "@/lib/ai/ifom";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { lesson_id, count = 20, difficulty = "intermediate" } = await req.json();
  const admin = createAdminClient();

  const { data: lesson } = await admin.from("lessons").select("*").eq("id", lesson_id).single();
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  let rawText = extractLessonIndexText(lesson);
  let rawHtml = "";

  if (lesson.kind === "html" && lesson.html_body) {
    rawHtml = lesson.html_body;
    rawText = rawText || lesson.html_body;
  } else if (lesson.storage_path) {
    const { data: blob } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
    if (blob) {
      if (lesson.kind === "html") {
        rawHtml = await blob.text();
        rawText = extractLessonIndexText(lesson, rawHtml) || rawHtml;
      } else if (lesson.kind === "pdf") {
        const pdfText = await extractPdfTextFromBuffer(Buffer.from(await blob.arrayBuffer()));
        rawText = extractLessonIndexText({ ...lesson, meta: { ...(lesson.meta ?? {}), extracted_text: pdfText } });
      }
    }
  }

  if (!rawText.trim() && !rawHtml.trim()) {
    return NextResponse.json({ error: "no extractable text in this document" }, { status: 400 });
  }

  const subject = detectIfomSubject(rawText || lesson.title);
  const topic = detectTopic(rawText || lesson.title, subject);

  const extracted = extractQuestionsFromImportedSource(rawText, {
    preferredDifficulty: difficulty,
    count,
    lessonId: lesson.id,
    rawHtml,
  });

  if (!extracted.length) {
    return NextResponse.json({
      error: "No question blocks found in this document. Questions must have a stem, answer choices (A–E), and a correct answer marker.",
    }, { status: 422 });
  }

  const rows = extracted.map(q => ({
    lesson_id,
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: q.explanation,
    difficulty: q.difficulty || difficulty,
    tags: Array.from(new Set([q.subject || subject, q.system || subject, q.topic || topic, ...(q.tags ?? [])].filter(Boolean))),
    image_path: q.image_path || null,
    image_caption: q.image_caption || null,
    ai_generated: false,
    created_by: ctx.user.id,
  }));

  const { data: inserted, error } = await admin.from("questions").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all(
    (inserted ?? []).map(async row => {
      const indexText = extractQuestionIndexText(row);
      if (indexText) { try { await indexSource("question", row.id, indexText); } catch { /* optional */ } }
    })
  );

  return NextResponse.json({ inserted: inserted?.length ?? rows.length, subject, topic });
}
