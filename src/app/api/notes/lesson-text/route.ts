/**
 * GET /api/notes/lesson-text
 * Returns list of visible lessons (no lesson_id) OR the extracted text of a specific lesson.
 * Accessible to any active student.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireActive, createAdminClient } from "@/lib/supabase/server";
import { extractLessonIndexText } from "@/lib/ai/source-text";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";

export const runtime = "nodejs";

function stripHtmlForNotes(html: string): string {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote|pre|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lessonId = req.nextUrl.searchParams.get("lesson_id");

  const admin = createAdminClient();

  // No lesson_id → return list of visible lessons the student can import from
  if (!lessonId) {
    const { data: lessons } = await admin
      .from("lessons")
      .select("id, title, kind")
      .in("kind", ["html", "html-file", "html-inline", "pdf"])
      .eq("visible", true)
      .order("title");
    return NextResponse.json({ lessons: lessons ?? [] });
  }

  // Fetch specific lesson text
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", lessonId).single();
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const isHtmlKind = (k: string) => k === "html" || k === "html-file" || k === "html-inline";

  // Inline HTML with stored body
  if (isHtmlKind(lesson.kind) && lesson.html_body) {
    return NextResponse.json({ text: stripHtmlForNotes(lesson.html_body), title: lesson.title });
  }

  // Stored file
  if (lesson.storage_path) {
    const { data: blob } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
    if (blob) {
      if (isHtmlKind(lesson.kind)) {
        const html = await blob.text();
        return NextResponse.json({ text: stripHtmlForNotes(html), title: lesson.title });
      }
      if (lesson.kind === "pdf") {
        try {
          const text = await extractPdfTextFromBuffer(Buffer.from(await blob.arrayBuffer()));
          return NextResponse.json({ text: text?.trim() ?? "", title: lesson.title });
        } catch {
          return NextResponse.json({ error: "PDF extraction failed" }, { status: 500 });
        }
      }
    }
  }

  // Fallback: use index text
  const text = extractLessonIndexText(lesson);
  return NextResponse.json({ text, title: lesson.title });
}
