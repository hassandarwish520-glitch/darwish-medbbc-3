/**
 * Question import — unified entry point.
 *
 * Priority:
 *  1. If rawHtml is provided → use the DOM-aware HTML parser (images scoped per block)
 *  2. Otherwise → use the text-based block parser (for PDF/plain-text exports)
 *
 * Both paths extract verbatim text. No AI, no reformulation.
 */
import { parseHtmlQuestions, type HtmlParsedQuestion } from "@/lib/import/html-question-parser";
import { detectDifficulty, detectIfomSubject, detectTopic } from "./ifom";
import { decodeEntities, normalizeText } from "./source-text";

// ─── Shared types ───────────────────────────────────────────────────────────

export type ImportedQuestionExtraction = {
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string;
  educational_objective?: string | null;
  difficulty: string;
  tags: string[];
  subject?: string;
  system?: string;
  topic?: string;
  image_path?: string | null;
  image_caption?: string | null;
};

type ExtractOptions = {
  preferredDifficulty?: string;
  count?: number;
  lessonId?: string;
  rawHtml?: string;
};

// ─── Text utilities ─────────────────────────────────────────────────────────

function clean(input: string) {
  return normalizeText(decodeEntities(input || ""));
}

function cleanLine(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

// ─── Text-based block parser (for plain text / PDF text) ───────────────────

/** Split plain text into question blocks */
function splitTextIntoBlocks(text: string): string[] {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Try splitting by "Question N" / "Q N." / "N." markers
  const chunks = normalized
    .split(/(?=^\s*(?:Question\s+\d+|Q[\s\-]*\d+[.:]|\d{1,3}[.)]\s+[A-Z]))/gim)
    .map(p => p.trim())
    .filter(Boolean);

  if (chunks.length > 1) return chunks;

  // Fall back to double-newline separation
  return normalized.split(/\n{2,}(?=(?:Question\s+\d+|Q\s*\d+|\d{1,3}[.)]))/gi)
    .map(p => p.trim())
    .filter(Boolean);
}

function parseChoicesFromText(text: string): { key: string; text: string }[] {
  const lines = text.split("\n");
  const choices: { key: string; text: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLine(lines[i]);
    const m = line.match(/^([A-E])[.):\s]\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toUpperCase();
    if (seen.has(key)) continue;

    let choiceText = m[2].trim();
    let j = i + 1;
    while (j < lines.length) {
      const next = cleanLine(lines[j]);
      if (!next) { j++; continue; }
      if (/^[A-E][.):\s]/i.test(next)) break;
      if (/^(?:Correct|Answer|Explanation|Educational\s*objective|Learning\s*objective|Subject|System|Topic|Rationale)/i.test(next)) break;
      choiceText += " " + next;
      j++;
    }
    choiceText = cleanLine(choiceText);
    if (choiceText) { choices.push({ key, text: choiceText }); seen.add(key); }
    i = j - 1;
  }

  // Compact fallback: "A. text B. text" on one line
  if (choices.length < 2) {
    const compact = text.replace(/\n+/g, " ");
    const matches = [...compact.matchAll(/([A-E])[.)]\s*([^A-E]+?)(?=\s+[A-E][.)]\s*|\s+(?:Correct|Answer|Explanation|Educational\s*objective)\b|$)/gi)];
    const seen2 = new Set<string>();
    return matches
      .map(m => ({ key: m[1].toUpperCase(), text: clean(m[2]) }))
      .filter(item => item.text && !seen2.has(item.key) && seen2.add(item.key));
  }

  return choices;
}

function parseAnswerKeyFromText(text: string, choices: { key: string }[]): string {
  const patterns = [
    /correct\s*answer\s*[:\-]\s*([A-E])/i,
    /answer\s*key\s*[:\-]\s*([A-E])/i,
    /(?:^|\n)\s*answer\s*[:\-]\s*([A-E])/im,
    /option\s+([A-E])\s+is\s+correct/i,
    /\(([A-E])\)\s+is\s+(?:the\s+)?correct/i,
    /correct\s+(?:choice|option|answer)\s+is\s+([A-E])/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return choices[0]?.key || "A";
}

function parseSectionFromText(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = text.match(
      new RegExp(`${escaped}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*(?:Explanation|Educational\\s*objective|Learning\\s*objective|Objective|Subject|System|Topic|Correct\\s*answer|Answer|Reference|$))`, "i")
    );
    if (m?.[1]) return cleanLine(clean(m[1]).replace(/\n+/g, " "));
  }
  return "";
}

function stripMarkdownArtifacts(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")    // ## heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1")     // __bold__
    .replace(/\*(.+?)\*/g, "$1")     // *italic*
    .trim();
}

function parseStemFromText(text: string): string {
  // Remove question number prefix
  let stem = text
    .replace(/^\s*(?:Question\s+\d+|Q\s*\d+)[.:\s]*/i, "")
    .replace(/^\s*\d{1,3}[.)]\s+/, "")
    .trim();

  // Cut at first choice (handles "• A." and "A." patterns)
  const choiceIdx = stem.search(/^\s*[•\-\*]?\s*\(?[A-E]\)?[.):\s]/m);
  if (choiceIdx > 0) stem = stem.slice(0, choiceIdx).trim();

  // Cut at section headers
  const sectionIdx = stem.search(/\n\s*(?:Correct|Answer|Explanation|Educational\s*objective|Learning\s*objective|Reference|Rationale)\s*[:\-]/im);
  if (sectionIdx > 0) stem = stem.slice(0, sectionIdx).trim();

  // Strip any markdown artefacts (## from doc-parser heading conversion, **bold**, etc.)
  return clean(stripMarkdownArtifacts(stem.replace(/\n+/g, " ")));
}

function extractTextBlock(text: string, preferredDifficulty: string): ImportedQuestionExtraction | null {
  const stem = parseStemFromText(text);
  const choices = parseChoicesFromText(text);
  if (!stem || stem.length < 8 || choices.length < 2) return null;

  const answerKey = parseAnswerKeyFromText(text, choices);
  const subject = parseSectionFromText(text, ["Subject"]) || detectIfomSubject(stem + "\n" + text.slice(0, 400));
  const system = parseSectionFromText(text, ["System", "Organ system"]) || subject;
  const topic = parseSectionFromText(text, ["Topic", "Theme"]) || detectTopic(stem + "\n" + text.slice(0, 400), subject);
  const educationalObjective = parseSectionFromText(text, ["Educational objective", "Learning objective", "Objective"]);
  const rawExplanation = parseSectionFromText(text, ["Explanation", "Rationale"]);
  const explanation = rawExplanation
    ? (educationalObjective ? `${rawExplanation}\n\nEducational objective: ${educationalObjective}` : rawExplanation)
    : (educationalObjective ? `Educational objective: ${educationalObjective}` : "No explanation provided.");
  const difficulty = detectDifficulty(stem + "\n" + rawExplanation, preferredDifficulty);

  return {
    stem,
    choices,
    answer_key: choices.find(c => c.key === answerKey) ? answerKey : choices[0].key,
    explanation,
    educational_objective: educationalObjective || null,
    difficulty,
    tags: [...new Set(["IFOM CSE", subject, system, topic, difficulty].filter(Boolean))],
    subject,
    system,
    topic,
    image_path: null,
    image_caption: null,
  };
}

// ─── Adapter: HtmlParsedQuestion → ImportedQuestionExtraction ──────────────

function adaptHtml(q: HtmlParsedQuestion): ImportedQuestionExtraction {
  return {
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: q.explanation,
    educational_objective: q.educational_objective,
    difficulty: q.difficulty,
    tags: q.tags,
    subject: q.subject,
    system: q.subject,
    topic: q.topic,
    image_path: q.image_path,
    image_caption: q.image_caption,
  };
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Extract questions from either HTML or plain text.
 *
 * When `options.rawHtml` is provided, the HTML DOM parser runs first — this
 * correctly scopes images to their containing block so they are never repeated.
 * Falls back to the text parser if the HTML parser yields nothing.
 */
export function extractQuestionsFromImportedSource(
  sourceText: string,
  options: ExtractOptions = {}
): ImportedQuestionExtraction[] {
  const count = Math.max(1, Math.min(options.count ?? 500, 1000));
  const difficulty = options.preferredDifficulty ?? "intermediate";
  const html = options.rawHtml ?? "";

  // ── Path A: HTML DOM parser ─────────────────────────────────────────────
  if (html.trim()) {
    const htmlResults = parseHtmlQuestions(html, { count, difficulty });
    if (htmlResults.length >= 1) return htmlResults.map(adaptHtml);
  }

  // ── Path B: also try treating sourceText as HTML if it looks like it ───
  if (!html && /<[a-z][^>]+>/i.test(sourceText)) {
    const htmlResults = parseHtmlQuestions(sourceText, { count, difficulty });
    if (htmlResults.length >= 1) return htmlResults.map(adaptHtml);
  }

  // ── Path C: plain-text block parser ────────────────────────────────────
  const blocks = splitTextIntoBlocks(sourceText);
  const results: ImportedQuestionExtraction[] = [];
  for (const block of blocks) {
    if (results.length >= count) break;
    const q = extractTextBlock(block, difficulty);
    if (q) results.push(q);
  }
  return results;
}
