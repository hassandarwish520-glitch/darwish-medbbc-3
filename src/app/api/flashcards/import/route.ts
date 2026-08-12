/**
 * POST /api/flashcards/import
 *
 * Student-facing flashcard importer. Accepts either:
 *   - lesson_id (existing lesson) → extract from that lesson's source text.
 *   - file upload (PDF/HTML/TXT/MD) + optional title + optional course_id →
 *     create a new lesson on the fly, then extract flashcards from it.
 *
 * Extraction is deterministic (no LLM, no invented content) — flashcards are
 * pulled verbatim from the source using flashcard-extract.
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";
import { extractFlashcardsFromText } from "@/lib/import/flashcard-extract";
import { extractLessonIndexText } from "@/lib/ai/source-text";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";
import { detectIfomSubject, detectTopic } from "@/lib/ai/ifom";
import { indexSource } from "@/lib/ai/rag";

export const runtime = "nodejs";
export const maxDuration = 120;

type AdminClient = ReturnType<typeof createAdminClient>;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|blockquote|pre)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readFileText(file: File): Promise<{ text: string; html: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfTextFromBuffer(buf);
    return { text: text.trim(), html: "" };
  }
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    const html = await file.text();
    return { text: stripHtml(html), html };
  }
  const text = await file.text();
  return { text: text.trim(), html: "" };
}

async function createLessonFromFile(
  admin: AdminClient,
  userId: string,
  file: File,
  title: string,
  courseId: string | null,
): Promise<{ id: string; title: string; text: string; html: string }> {
  const { text, html } = await readFileText(file);
  const lower = file.name.toLowerCase();
  const finalTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");

  const baseRow: Record<string, unknown> = {
    title: finalTitle,
    course_id: courseId,
    created_by: userId,
    visible: true,
  };

  let lessonRow: Record<string, unknown>;
  let indexTextForRag = "";

  if (lower.endsWith(".pdf")) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storagePath = `${Date.now()}-${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from("lesson-assets")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/pdf",
      });
    if (upErr) throw new Error(upErr.message);
    lessonRow = {
      ...baseRow,
      kind: "pdf",
      storage_path: storagePath,
      meta: {
        original_name: file.name,
        file_size: file.size,
        extracted_text: text,
        source: "student_import",
      },
    };
    indexTextForRag = extractLessonIndexText({
      kind: "pdf",
      meta: (lessonRow as any).meta,
    });
  } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    lessonRow = {
      ...baseRow,
      kind: "html",
      html_body: html,
      meta: {
        original_name: file.name,
        file_size: file.size,
        source: "student_import",
        index_text: text,
      },
    };
    indexTextForRag = extractLessonIndexText({
      kind: "html",
      html_body: html,
      meta: (lessonRow as any).meta,
    });
  } else {
    // TXT / MD → wrap as inline HTML lesson so the viewer still works
    const wrappedHtml = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;background:#020617;color:#e2e8f0;"><pre style="white-space:pre-wrap;line-height:1.7">${escapeHtml(
      text,
    )}</pre></body></html>`;
    lessonRow = {
      ...baseRow,
      kind: "html",
      html_body: wrappedHtml,
      meta: {
        original_name: file.name,
        file_size: file.size,
        source: "student_import",
        index_text: text,
      },
    };
    indexTextForRag = text;
  }

  const { data: lesson, error } = await admin
    .from("lessons")
    .insert(lessonRow)
    .select("id, title")
    .single();
  if (error) throw new Error(error.message);

  if (indexTextForRag) {
    try {
      await indexSource("lesson", lesson.id, indexTextForRag);
    } catch {
      /* non-blocking */
    }
  }

  return { id: lesson.id, title: lesson.title, text, html };
}

async function loadLessonText(
  admin: AdminClient,
  lessonId: string,
): Promise<{ text: string; html: string; title: string }> {
  const { data: lesson } = await admin
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();
  if (!lesson) return { text: "", html: "", title: "" };

  let text = extractLessonIndexText(lesson);
  let html = "";

  if (lesson.kind === "html" && lesson.html_body) {
    html = lesson.html_body;
    text = text || stripHtml(lesson.html_body);
  } else if (lesson.storage_path) {
    const { data: blob } = await admin.storage
      .from("lesson-assets")
      .download(lesson.storage_path);
    if (blob) {
      if (lesson.kind === "html") {
        html = await blob.text();
        text = extractLessonIndexText(lesson, html);
      } else if (lesson.kind === "pdf") {
        const pdfText = await extractPdfTextFromBuffer(
          Buffer.from(await blob.arrayBuffer()),
        );
        text = extractLessonIndexText({
          ...lesson,
          meta: { ...(lesson.meta ?? {}), extracted_text: pdfText },
        });
      }
    }
  }

  return { text, html, title: lesson.title };
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const form = await req.formData();

  const lessonIdField = String(form.get("lesson_id") || "").trim();
  const courseIdField = String(form.get("course_id") || "").trim() || null;
  const titleField = String(form.get("title") || "").trim();
  const countField = Number(form.get("count") || 30);
  const rawCount = Number.isFinite(countField) ? countField : 30;
  const maxCards = Math.max(5, Math.min(80, rawCount));

  const rawFile = form.get("file");
  const file = rawFile && typeof rawFile !== "string" ? (rawFile as File) : null;

  if (!lessonIdField && !file) {
    return NextResponse.json(
      { error: "Provide either an existing lesson_id or a file to import." },
      { status: 400 },
    );
  }

  let targetLessonId = lessonIdField;
  let sourceTitle = "";
  let text = "";
  let html = "";

  try {
    if (file) {
      const created = await createLessonFromFile(
        admin,
        ctx.user.id,
        file,
        titleField,
        courseIdField,
      );
      targetLessonId = created.id;
      sourceTitle = created.title;
      text = created.text;
      html = created.html;
    } else {
      const loaded = await loadLessonText(admin, targetLessonId);
      sourceTitle = loaded.title;
      text = loaded.text;
      html = loaded.html;
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to prepare source" },
      { status: 500 },
    );
  }

  if (!text.trim() && !html.trim()) {
    return NextResponse.json(
      {
        error:
          "No extractable text in this source. Try a PDF with real text (not scanned images) or an HTML / TXT / Markdown file.",
      },
      { status: 422 },
    );
  }

  const subject = detectIfomSubject(text || sourceTitle);
  const topic = detectTopic(text || sourceTitle, subject);
  const tags = [subject, topic].filter(Boolean);

  const cards = extractFlashcardsFromText(text || html, {
    isHtml: !text && Boolean(html),
    maxCards,
    tags,
  });

  if (!cards.length) {
    return NextResponse.json(
      {
        error:
          "No flashcard-worthy content found. This file may be pure prose without structured facts. Try a file that contains labelled sections (Definition:, Features:, Treatment:, lab values, bullet lists).",
      },
      { status: 422 },
    );
  }

  const rows = cards.map((card) => ({
    lesson_id: targetLessonId,
    front: card.front,
    back: card.back,
    section: card.section ?? null,
    tags: [...new Set([...card.tags, ...tags])].filter(Boolean),
    ai_generated: false,
    created_by: ctx.user.id,
  }));

  const { data: inserted, error } = await admin
    .from("flashcards")
    .insert(rows)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: inserted?.length ?? rows.length,
    lesson_id: targetLessonId,
    source_title: sourceTitle,
    subject,
    topic,
  });
}
