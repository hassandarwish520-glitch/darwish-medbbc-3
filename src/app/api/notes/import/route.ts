/**
 * POST /api/notes/import
 * Accepts a file upload (PDF, TXT, HTML, MD) and returns the extracted raw text.
 * Content is taken verbatim from the file — no AI generation, no invented summaries.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/supabase/server";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = (file as File).name ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    try {
      const buf = Buffer.from(await (file as File).arrayBuffer());
      const text = await extractPdfTextFromBuffer(buf);
      if (!text?.trim()) {
        return NextResponse.json(
          { error: "Could not extract text from this PDF. It may be image-only or password-protected." },
          { status: 422 },
        );
      }
      return NextResponse.json({ text: text.trim() });
    } catch {
      return NextResponse.json({ error: "PDF extraction failed" }, { status: 500 });
    }
  }

  if (["txt", "md"].includes(ext)) {
    const text = await (file as File).text();
    return NextResponse.json({ text: text.trim() });
  }

  if (["html", "htm"].includes(ext)) {
    const raw = await (file as File).text();
    return NextResponse.json({ text: stripHtml(raw) });
  }

  return NextResponse.json(
    { error: "Unsupported file type. Use .txt, .md, .html, or .pdf" },
    { status: 400 },
  );
}
