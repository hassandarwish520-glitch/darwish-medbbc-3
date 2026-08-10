import { parseDirectImportFile } from "@/lib/import/direct-import";
import { parseDocumentBuffer } from "@/lib/import/doc-parser";
import { parseHtmlQuestions } from "@/lib/import/html-question-parser";
import { extractQuestionsFromImportedSource } from "@/lib/ai/question-import";

export type ImportedQBankQuestion = {
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

function mapDirectQuestions(items: ReturnType<typeof parseDirectImportFile>): ImportedQBankQuestion[] {
  return items.map((q) => ({
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

function mapExtractedQuestions(items: ReturnType<typeof extractQuestionsFromImportedSource>): ImportedQBankQuestion[] {
  return items.map((q) => ({
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

function mapHtmlQuestions(items: ReturnType<typeof parseHtmlQuestions>): ImportedQBankQuestion[] {
  return items.map((q) => ({
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
}

function extractInlineScriptBodies(rawHtml: string): string[] {
  const scriptBodies: string[] = [];
  const scriptRe = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRe.exec(rawHtml)) !== null) {
    const body = (scriptMatch[1] || "").trim();
    if (body.length > 2 && /\[\s*\{/.test(body)) scriptBodies.push(body);
  }
  return scriptBodies;
}

export function importQuestionsFromFileBuffer(args: {
  bytes: Buffer;
  filename: string;
  difficulty: string;
}): ImportedQBankQuestion[] {
  const { bytes, filename, difficulty } = args;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  let questions: ImportedQBankQuestion[] = [];

  if (["json", "js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext)) {
    const rawText = bytes.toString("utf-8");
    const direct = parseDirectImportFile(rawText, filename, difficulty);
    if (direct.length) return mapDirectQuestions(direct);
  }

  if (["html", "htm"].includes(ext)) {
    const rawHtml = bytes.toString("utf-8");

    for (const body of extractInlineScriptBodies(rawHtml)) {
      const direct = parseDirectImportFile(body, `${filename}#script`, difficulty);
      if (direct.length) return mapDirectQuestions(direct);
    }

    const htmlParsed = parseHtmlQuestions(rawHtml, { count: 1000, difficulty });
    if (htmlParsed.length) return mapHtmlQuestions(htmlParsed);

    const parsed = parseDocumentBuffer(bytes, filename);
    const extracted = extractQuestionsFromImportedSource(parsed.text, {
      preferredDifficulty: difficulty,
      count: 1000,
      rawHtml,
    });
    questions = mapExtractedQuestions(extracted);
    if (questions.length) return questions;
  }

  if (ext === "pdf") {
    return [];
  }

  const parsed = parseDocumentBuffer(bytes, filename);
  if (!parsed.isEmpty) {
    const isHtmlLike = /<[a-z][^>]+>/i.test(parsed.text.slice(0, 2000));
    const rawHtml = isHtmlLike ? parsed.text : "";
    const extracted = extractQuestionsFromImportedSource(parsed.text, {
      preferredDifficulty: difficulty,
      count: 1000,
      rawHtml,
    });
    questions = mapExtractedQuestions(extracted);
    if (questions.length) return questions;
  }

  const rawText = bytes.toString("utf-8");
  const direct = parseDirectImportFile(rawText, filename, difficulty);
  return direct.length ? mapDirectQuestions(direct) : [];
}
