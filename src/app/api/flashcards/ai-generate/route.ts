/**
 * Flashcard extraction from source document — NO AI-generated placeholder content.
 * Extracts real flashcards directly from the lesson/document text.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { extractFlashcardsFromText } from "@/lib/import/flashcard-extract";
import { extractLessonIndexText } from "@/lib/ai/source-text";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";
import { detectIfomSubject, detectTopic } from "@/lib/ai/ifom";

export const runtime = "nodejs";
export const maxDuration = 120;

async function getLessonText(admin: ReturnType<typeof createAdminClient>, lessonId: string): Promise<{ text: string; html: string; title: string; subject: string; topic: string }> {
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", lessonId).single();
  if (!lesson) return { text: "", html: "", title: "", subject: "", topic: "" };

  const isHtmlKind = (k: string) => k === "html" || k === "html-file" || k === "html-inline";
  let text = extractLessonIndexText(lesson);
  let html = "";

  if (isHtmlKind(lesson.kind) && lesson.html_body) {
    html = lesson.html_body;
    text = text || lesson.html_body;
  } else if (lesson.storage_path) {
    const { data: blob } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
    if (blob) {
      if (isHtmlKind(lesson.kind)) {
        html = await blob.text();
        text = extractLessonIndexText(lesson, html);
      } else if (lesson.kind === "pdf") {
        const pdfText = await extractPdfTextFromBuffer(Buffer.from(await blob.arrayBuffer()));
        text = extractLessonIndexText({ ...lesson, meta: { ...(lesson.meta ?? {}), extracted_text: pdfText } });
      }
    }
  }

  const subject = detectIfomSubject(text || lesson.title);
  const topic = detectTopic(text || lesson.title, subject);
  return { text, html, title: lesson.title, subject, topic };
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { lesson_id, count = 20 } = await req.json();
  const admin = createAdminClient();

  const { text, html, title, subject, topic } = await getLessonText(admin, lesson_id);
  if (!text.trim() && !html.trim()) {
    return NextResponse.json({ error: "no extractable text in this document — add HTML content or index text for PDF lessons" }, { status: 400 });
  }

  const tags = [subject, topic].filter(Boolean);
  const cards = extractFlashcardsFromText(text || html, {
    isHtml: !text && Boolean(html),
    maxCards: Math.min(count, 80),
    tags,
  });

  if (!cards.length) {
    return NextResponse.json({
      error: "No flashcard-worthy content found in this document. The source may not have clearly structured medical facts. Try importing a document with labelled sections (e.g. Definition:, Features:, Treatment:).",
    }, { status: 422 });
  }

  const rows = cards.map(card => ({
    lesson_id,
    front: card.front,
    back: card.back,
    section: card.section ?? null,
    tags: [...new Set([...card.tags, ...tags])].filter(Boolean),
    ai_generated: false,
    created_by: ctx.user.id,
  }));

  const { data: inserted, error } = await admin.from("flashcards").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    inserted: inserted?.length ?? rows.length,
    subject,
    topic,
    source_title: title,
  });
}
