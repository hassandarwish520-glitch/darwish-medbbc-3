/**
 * QBank import — verbatim extraction, no AI, no reformulation.
 *
 * Processing order:
 *  1. JSON / JS / TS  → structured direct parse (exact field mapping)
 *  2. HTML / HTM      → DOM-aware HTML parser (images scoped per block)
 *  3. PDF             → text extraction → text-block parser
 *  4. DOCX/PPTX/EPUB/ZIP/MHTML/MD/TXT → doc-parser → text-block parser
 *
 * Supported formats: JSON, JS, TS, PDF, DOCX, PPTX, EPUB, ZIP, MHTML, MHT,
 *                    HTML, HTM, TXT, MD, and any other text-like file.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { parseDirectImportFile } from "@/lib/import/direct-import";
import { extractQuestionsFromImportedSource } from "@/lib/ai/question-import";
import { parseDocumentBuffer } from "@/lib/import/doc-parser";
import { parseHtmlQuestions } from "@/lib/import/html-question-parser";

export const runtime = "nodejs";
export const maxDuration = 120;

async function extractPdfText(bytes: Buffer): Promise<string> {
  try {
    const { extractPdfTextFromBuffer } = await import("@/lib/ai/pdf");
    return await extractPdfTextFromBuffer(bytes);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const difficulty = String(fd.get("difficulty") || "intermediate");
  const tagsRaw = String(fd.get("tags") || "");
  const extraTags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
  const lessonIdRaw = String(fd.get("lesson_id") || "").trim();
  const lesson_id = lessonIdRaw || null;

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const filename = file.name || "import";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const bytes = Buffer.from(await file.arrayBuffer());

  type Q = {
    stem: string;
    choices: { key: string; text: string }[];
    answer_key: string;
    explanation: string;
    image_path: string | null;
    image_caption: string | null;
    difficulty: string;
    tags: string[];
    subject: string;
    system: string;
    topic: string;
  };

  let questions: Q[] = [];

  // ── Path 1: JSON / JS / TS structured parse ──────────────────────────────
  if (["json", "js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext)) {
    const rawText = bytes.toString("utf-8");
    const direct = parseDirectImportFile(rawText, filename, difficulty);
    if (direct.length) {
      questions = direct.map(q => ({
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        image_path: q.image_path,
        image_caption: q.image_caption,
        difficulty: q.difficulty,
        tags: q.tags,
        subject: q.subject,
        system: q.system,
        topic: q.topic,
      }));
    }
  }

  // ── Path 2: HTML / HTM — quiz-app exports store questions in inline <script> ─
  if (!questions.length && ["html", "htm"].includes(ext)) {
    const rawHtml = bytes.toString("utf-8");

    // Path 2a: extract any inline <script> containing `const questions = [...]`
    // before falling back to DOM parsing. These quiz-app exports keep all
    // question data (including embedded base64 images) inside the script tag,
    // so the visible DOM contains no question markup at all.
    const scriptBodies: string[] = [];
    const scriptRe = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch: RegExpExecArray | null;
    while ((scriptMatch = scriptRe.exec(rawHtml)) !== null) {
      const body = (scriptMatch[1] || "").trim();
      if (body.length > 2 && /\[\s*\{/.test(body)) scriptBodies.push(body);
    }
    for (const body of scriptBodies) {
      const direct = parseDirectImportFile(body, `${filename}#script`, difficulty);
      if (direct.length) {
        questions = direct.map(q => ({
          stem: q.stem,
          choices: q.choices,
          answer_key: q.answer_key,
          explanation: q.explanation,
          image_path: q.image_path,
          image_caption: q.image_caption,
          difficulty: q.difficulty,
          tags: q.tags,
          subject: q.subject,
          system: q.system,
          topic: q.topic,
        }));
        break;
      }
    }

    // Path 2b: DOM-level HTML parser (images scoped per block)
    const htmlParsed = questions.length ? [] : parseHtmlQuestions(rawHtml, { count: 1000, difficulty });
    if (htmlParsed.length) {
      questions = htmlParsed.map(q => ({
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        image_path: q.image_path,
        image_caption: q.image_caption,
        difficulty: q.difficulty,
        tags: q.tags,
        subject: q.subject,
        system: q.subject,
        topic: q.topic,
      }));
    } else {
      // Fallback: text-based parser on the cleaned HTML text
      const parsed = parseDocumentBuffer(bytes, filename);
      const extracted = extractQuestionsFromImportedSource(parsed.text, {
        preferredDifficulty: difficulty,
        count: 1000,
        rawHtml,
      });
      questions = extracted.map(q => ({
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        image_path: q.image_path ?? null,
        image_caption: q.image_caption ?? null,
        difficulty: q.difficulty,
        tags: q.tags,
        subject: q.subject ?? "",
        system: q.system ?? "",
        topic: q.topic ?? "",
      }));
    }
  }

  // ── Path 3: PDF ──────────────────────────────────────────────────────────
  if (!questions.length && ext === "pdf") {
    const pdfText = await extractPdfText(bytes);
    const extracted = extractQuestionsFromImportedSource(pdfText, {
      preferredDifficulty: difficulty,
      count: 1000,
    });
    questions = extracted.map(q => ({
      stem: q.stem,
      choices: q.choices,
      answer_key: q.answer_key,
      explanation: q.explanation,
      image_path: q.image_path ?? null,
      image_caption: q.image_caption ?? null,
      difficulty: q.difficulty,
      tags: q.tags,
      subject: q.subject ?? "",
      system: q.system ?? "",
      topic: q.topic ?? "",
    }));
  }

  // ── Path 4: All other formats (DOCX, PPTX, EPUB, ZIP, MHTML, MD, TXT) ───
  if (!questions.length) {
    const parsed = parseDocumentBuffer(bytes, filename);

    if (!parsed.isEmpty) {
      // If the doc-parser produced HTML-like output, try HTML path first
      const isHtmlLike = /<[a-z][^>]+>/i.test(parsed.text.slice(0, 2000));
      const rawHtml = isHtmlLike ? parsed.text : "";

      const extracted = extractQuestionsFromImportedSource(parsed.text, {
        preferredDifficulty: difficulty,
        count: 1000,
        rawHtml,
      });
      questions = extracted.map(q => ({
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        image_path: q.image_path ?? null,
        image_caption: q.image_caption ?? null,
        difficulty: q.difficulty,
        tags: q.tags,
        subject: q.subject ?? "",
        system: q.system ?? "",
        topic: q.topic ?? "",
      }));
    }
  }

  // ── Also try JSON structured parse on any format as last resort ──────────
  if (!questions.length) {
    const rawText = bytes.toString("utf-8");
    const direct = parseDirectImportFile(rawText, filename, difficulty);
    if (direct.length) {
      questions = direct.map(q => ({
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        image_path: q.image_path,
        image_caption: q.image_caption,
        difficulty: q.difficulty,
        tags: q.tags,
        subject: q.subject,
        system: q.system,
        topic: q.topic,
      }));
    }
  }

  if (!questions.length) {
    return NextResponse.json(
      {
        error: `No questions found in this ${ext.toUpperCase() || "file"}.\n\nThe import engine looks for:\n• Stems followed by choices labelled A. B. C. D. E.\n• A "Correct Answer: X" marker\n• An "Explanation:" section\n\nFor HTML exports from Active QBank or similar: export as HTML and upload that file directly.`,
      },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  const rows = questions.map(q => ({
    lesson_id,
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: q.explanation,
    difficulty: q.difficulty || difficulty,
    tags: [...new Set([...extraTags, ...(q.tags ?? []), q.subject, q.system, q.topic].filter(Boolean))],
    image_path: q.image_path || null,
    image_caption: q.image_caption || null,
    ai_generated: false,
    created_by: ctx.user.id,
  }));

  const { data: inserted, error } = await admin.from("questions").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: inserted?.length ?? rows.length,
    total: rows.length,
    format: ext || "auto",
  });
}
