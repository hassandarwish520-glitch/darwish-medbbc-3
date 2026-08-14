/**
 * Real HTML Question Block Parser
 *
 * Works directly on the HTML structure — NOT on converted plain text.
 * Each question block is isolated first; images are extracted only from
 * within that block, so the same image is never repeated across questions.
 * All stem / choice / explanation text is verbatim from the source.
 *
 * Handles: Active QBank exports, AMBOSS, UWorld-style HTML,
 *          table-based layouts, div-based layouts, sequential paragraph layouts.
 */

import { detectDifficulty, detectIfomSubject, detectTopic } from "@/lib/ai/ifom";

// ─── Types ─────────────────────────────────────────────────────────────────

export type HtmlParsedQuestion = {
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string;
  educational_objective: string | null;
  image_path: string | null;
  image_caption: string | null;
  subject: string;
  topic: string;
  difficulty: string;
  tags: string[];
};

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Strip all HTML tags; decode entities; normalise whitespace */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|li|tr|td|th|h[1-6]|blockquote|pre|dt|dd)>/gi, "\n")
    // Do NOT add "• " prefix to list items — it breaks "A. text" choice detection
    .replace(/<li\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Return all <img src="…"> values from a chunk of HTML — IN ORDER */
function extractImgSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1].trim();
    if (src && !srcs.includes(src)) srcs.push(src);
  }
  return srcs;
}

/** Return the alt text of the first img in the HTML */
function extractImgAlt(html: string): string | null {
  const m = html.match(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*/i);
  return m?.[1]?.trim() || null;
}

/** Trim and clean a single text line */
function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

/** Strip markdown artefacts that creep in when headings are converted to text */
function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")    // ## heading markers (from h2→## conversion)
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/__(.+?)__/g, "$1")     // __bold__
    .replace(/\*(.+?)\*/g, "$1")     // *italic*
    .replace(/^[-*_]{3,}\s*$/gm, "") // --- horizontal rules
    .trim();
}

/** Remove markdown and leading question-number from a stem string */
function cleanStem(s: string): string {
  return stripMarkdown(s)
    .replace(/^\s*(?:Question\s+\d+|Q\s*\d+)[.:\s]*/i, "")
    .replace(/^\s*\d{1,3}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does this chunk of text/HTML contain at least 2 answer-choice lines? */
function hasChoices(text: string): boolean {
  const choiceCount = (text.match(/^\s*[A-Z][\s.)\-:]/gm) || []).length;
  return choiceCount >= 2;
}

// ─── HTML nesting splitter ──────────────────────────────────────────────────
/**
 * Split an HTML string into top-level blocks defined by a given tag name,
 * respecting nesting (so inner divs don't close the outer one early).
 */
function splitByTag(html: string, tagName: string, classMatcher?: RegExp): string[] {
  const tag = tagName.toLowerCase();
  const openRe = new RegExp(`<${tag}(\\b[^>]*)>`, "gi");
  const closeRe = new RegExp(`<\\/${tag}>`, "gi");
  const blocks: string[] = [];

  const opens: { idx: number; attr: string }[] = [];
  const closes: number[] = [];

  let m: RegExpExecArray | null;
  openRe.lastIndex = 0;
  while ((m = openRe.exec(html)) !== null) {
    opens.push({ idx: m.index, attr: m[1] || "" });
  }
  closeRe.lastIndex = 0;
  while ((m = closeRe.exec(html)) !== null) {
    closes.push(m.index + m[0].length);
  }

  // Match opens to closes by tracking depth
  const used = new Set<number>();
  for (const open of opens) {
    if (classMatcher && !classMatcher.test(open.attr)) continue;
    // Count how many opens precede this close
    let depth = 0;
    let closeIdx = -1;
    for (let ci = 0; ci < closes.length; ci++) {
      if (used.has(ci)) continue;
      const closePos = closes[ci];
      if (closePos <= open.idx) continue;
      // Count opens between open.idx and closePos
      const innerOpens = opens.filter(o => o.idx > open.idx && o.idx < closePos).length;
      const innerCloses = closes.filter(c => !used.has(closes.indexOf(c)) && c > open.idx && c < closePos).length;
      if (innerOpens === innerCloses) {
        closeIdx = ci;
        break;
      }
    }
    if (closeIdx >= 0) {
      used.add(closeIdx);
      const block = html.slice(open.idx, closes[closeIdx]);
      if (block.length > 20) blocks.push(block);
    }
  }
  return blocks;
}

// ─── Strategy 1: Explicit class-based question containers ───────────────────
const QUESTION_CLASS_RE = /class=["'][^"']*\b(?:question|qblock|q-block|question-block|question-card|item-question|vignette)\b[^"']*["']/i;
const QUESTION_ID_RE = /id=["'](?:question|q)[-_]?\d+["']/i;

function findClassContainers(html: string): string[] {
  // Try div, section, article
  for (const tag of ["div", "section", "article", "li"]) {
    const blocks = splitByTag(html, tag, QUESTION_CLASS_RE);
    if (blocks.length >= 2) return blocks;
    const idBlocks = splitByTag(html, tag, QUESTION_ID_RE);
    if (idBlocks.length >= 2) return idBlocks;
  }
  return [];
}

// ─── Strategy 2: Split by question-number markers ──────────────────────────
/**
 * Finds positions in HTML where a new question begins.
 * Markers: "Question N", "Q N.", "N." at start of <p>/<h> element, "--- Q N ---"
 */
const Q_MARKER_RE =
  /<(?:h[1-6]|p|strong|b|div|section|article)[^>]*>\s*(?:Question\s+\d+|Q[\s\-]*\d+[.:]|\d{1,3}[.)]\s+[A-Z])/gi;
const Q_MARKER_PLAIN_RE = /(?:^|\n)\s*(?:Question\s+\d+|Q\s*\d+[.:]|\d{1,3}[.)]\s+(?=[A-Z]))/gm;

function splitByQuestionMarkers(html: string): string[] {
  const positions: number[] = [];

  // In HTML tags
  const re = new RegExp(Q_MARKER_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) positions.push(m.index);

  if (positions.length < 2) {
    // Try in plain text derived from html
    const text = htmlToText(html);
    const re2 = new RegExp(Q_MARKER_PLAIN_RE.source, "gim");
    const textPositions: number[] = [];
    while ((m = re2.exec(text)) !== null) textPositions.push(m.index);

    if (textPositions.length >= 2) {
      // Use text-level splitting as fallback while preserving each marker.
      const parts: string[] = [];
      for (let i = 0; i < textPositions.length; i++) {
        const start = textPositions[i];
        const end = i + 1 < textPositions.length ? textPositions[i + 1] : text.length;
        parts.push(text.slice(start, end));
      }
      return parts.filter(p => hasChoices(p));
    }
  }

  if (positions.length < 2) return [];

  const blocks: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    blocks.push(html.slice(start, end));
  }
  return blocks;
}

// ─── Strategy 3: Split by <hr> / page-break elements ──────────────────────
function splitByHr(html: string): string[] {
  const parts = html.split(/<hr\b[^>]*\/?>/gi);
  if (parts.length < 2) {
    // Try page-break divs
    const pageBreakParts = html.split(/<div[^>]+class=["'][^"']*page.?break[^"']*["'][^>]*>/gi);
    if (pageBreakParts.length >= 2) return pageBreakParts.filter(p => hasChoices(p));
  }
  return parts.filter(p => hasChoices(p));
}

// ─── Strategy 4: Table-based layouts ──────────────────────────────────────
/**
 * Active QBank sometimes uses a table where each row is a question.
 * Or the whole question is inside a single <td>.
 */
function splitByTable(html: string): string[] {
  const rows = splitByTag(html, "tr");
  const questionRows = rows.filter(r => hasChoices(htmlToText(r)));
  if (questionRows.length >= 2) return questionRows;

  // Maybe the whole table is one question — try splitting by td
  const cells = splitByTag(html, "td");
  return cells.filter(c => hasChoices(htmlToText(c)));
}

// ─── Strategy 5: Sequential paragraph scan ────────────────────────────────
/**
 * Last resort: convert to text and split by "N." question number patterns.
 * The positions are approximate but the text is verbatim.
 */
function splitByParagraphText(html: string): string[] {
  const text = htmlToText(html);
  // Split wherever we see "Question N" or "N." followed by a capital letter
  const QNUM = /(?:^|\n\n)(?:Question\s+\d+[.:\s]|\d{1,3}[.)]\s+(?=[A-Z]))/gm;
  const parts = text.split(QNUM).filter(Boolean).map(p => p.trim());
  return parts.filter(p => hasChoices(p));
}

// ─── Main HTML splitter ────────────────────────────────────────────────────
function splitHtmlIntoQuestionBlocks(html: string): string[] {
  // Try each strategy in order of reliability
  const s1 = findClassContainers(html);
  if (s1.length >= 2) return s1;

  const s2 = splitByQuestionMarkers(html);
  if (s2.length >= 2) return s2;

  const s3 = splitByHr(html);
  if (s3.length >= 2) return s3;

  const s4 = splitByTable(html);
  if (s4.length >= 2) return s4;

  const s5 = splitByParagraphText(html);
  if (s5.length >= 2) return s5;

  // Active QBank exports may repeat answer markers without question numbers.
  const answerMarkers = [...html.matchAll(/(?:correct\s+answer|answer\s+key)\s*[:\-]/gi)];
  if (answerMarkers.length >= 2) {
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < answerMarkers.length; i++) {
      const markerEnd = answerMarkers[i].index! + answerMarkers[i][0].length;
      const next = i + 1 < answerMarkers.length ? answerMarkers[i + 1].index! : html.length;
      const segment = html.slice(start, next);
      if (hasChoices(htmlToText(segment))) parts.push(segment);
      start = markerEnd;
    }
    if (parts.length >= 2) return parts;
  }

  // If nothing splits, treat the whole thing as one block
  return [html];
}

// ─── Choice parser (works on text from a single block) ─────────────────────
function parseChoicesFromText(text: string): { key: string; text: string }[] {
  const lines = text.split("\n");
  const choices: { key: string; text: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLine(lines[i]);
    // Match: "A. text", "A) text", "A: text", "(A) text"
    // Also handles "• A. text" (when li bullet prefix survives), "- A. text"
    const m = line.match(/^[•\-\*]?\s*\(?([A-Z])\)?[.):\s]\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toUpperCase();
    if (seen.has(key)) continue;

    // Gather continuation lines
    let choiceText = m[2].trim();
    let j = i + 1;
    while (j < lines.length) {
      const next = cleanLine(lines[j]);
      if (!next) { j++; continue; }
      // Stop if next line starts a new choice or a section
      if (/^[A-Z][.):\s]/i.test(next)) break;
      if (/^(Correct|Answer|Explanation|Educational\s*objective|Learning\s*objective|Subject|System|Topic|Rationale|Reference)/i.test(next)) break;
      choiceText += " " + next;
      j++;
    }
    choiceText = cleanLine(choiceText);
    if (choiceText) {
      choices.push({ key, text: choiceText });
      seen.add(key);
    }
    i = j - 1;
  }

  return choices;
}

// ─── Answer key extractor ──────────────────────────────────────────────────
function extractAnswerKey(blockHtml: string, text: string, choices: { key: string }[]): string {
  // 1. class="correct" or class="answer-correct" on a choice element
  const correctClassMatch = blockHtml.match(
    /<(?:li|div|p|td)[^>]+class=["'][^"']*\b(?:correct|answer-correct|right|is-correct|selected-correct)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|div|p|td)>/i
  );
  if (correctClassMatch) {
    const choiceText = htmlToText(correctClassMatch[1]).trim();
    // Extract the key letter
    const keyM = choiceText.match(/^([A-Z])[.):\s]/i);
    if (keyM) return keyM[1].toUpperCase();
    // Match against choice texts
    for (const c of choices) {
      if (choiceText.toLowerCase().startsWith(c.key.toLowerCase())) return c.key;
    }
  }

  // 2. data-correct / aria-checked / data-answer attributes
  const dataAttrM = blockHtml.match(/data-(?:correct|answer|key)=["']([A-Z])["']/i);
  if (dataAttrM) return dataAttrM[1].toUpperCase();

  // 3. "Correct Answer: B" / "Answer: B" / "Key: B" in text
  const textPatterns = [
    /correct\s*answer\s*[:\-]\s*([A-Z])/i,
    /answer\s*key\s*[:\-]\s*([A-Z])/i,
    /(?:^|\n)\s*answer\s*[:\-]\s*([A-Z])/im,
    /option\s+([A-Z])\s+is\s+correct/i,
    /\(([A-Z])\)\s+is\s+(?:the\s+)?correct/i,
    /(?:the\s+)?correct\s+(?:choice|option|answer)\s+is\s+([A-Z])/i,
  ];
  for (const p of textPatterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].toUpperCase();
  }

  // 4. Bold/highlighted text matching a choice key
  const boldM = blockHtml.match(/<(?:strong|b)[^>]*>\s*([A-Z])\s*<\/(?:strong|b)>/i);
  if (boldM) return boldM[1].toUpperCase();

  return choices[0]?.key || "A";
}

// ─── Stem extractor ────────────────────────────────────────────────────────
function extractStem(text: string): string {
  // Remove the question number prefix
  let stem = text
    .replace(/^(?:Question\s+\d+|Q\s*\d+)[.:\s]*/i, "")
    .replace(/^\s*\d{1,3}[.)]\s+/, "")
    .trim();

  // Cut off at the first choice (handles "A." and "• A." prefixed lines)
  const choiceIdx = stem.search(/^\s*[•\-\*]?\s*\(?[A-Z]\)?[.):\s]/m);
  if (choiceIdx > 0) stem = stem.slice(0, choiceIdx).trim();

  // Also cut at section markers
  const sectionIdx = stem.search(/\n\s*(?:Correct|Answer|Explanation|Educational\s*objective|Learning\s*objective|Reference|Rationale)\s*[:\-]/im);
  if (sectionIdx > 0) stem = stem.slice(0, sectionIdx).trim();

  // Strip markdown artefacts (## from heading conversion, **bold**, etc.)
  return cleanStem(stem.replace(/\n+/g, " "));
}

// ─── Explanation extractor ──────────────────────────────────────────────────
function extractExplanation(text: string): { explanation: string; educationalObjective: string | null } {
  const EXPL_RE = /(?:Explanation|Rationale|Discussion)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:Educational\s*objective|Learning\s*objective|Reference|Subject|System|Topic|$))/i;
  const OBJ_RE = /(?:Educational\s*objective|Learning\s*objective|Objective)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:Reference|Subject|System|Topic|$))/i;

  const explM = text.match(EXPL_RE);
  const objM = text.match(OBJ_RE);

  const explanation = cleanLine((explM?.[1] || "").replace(/\n+/g, " "));
  const educationalObjective = objM ? cleanLine((objM[1] || "").replace(/\n+/g, " ")) : null;

  return { explanation: explanation || "No explanation provided.", educationalObjective: educationalObjective || null };
}


// Extracts an explicit heading-style title for a question block.
// Looks for the first <h1..h4> / .question-title / <strong> at the top
// of the block before the stem paragraph.
function extractBlockTitle(blockHtml: string): string | null {
  const headingMatch = blockHtml.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  if (headingMatch) {
    const txt = htmlToText(headingMatch[1]).trim();
    if (txt.length >= 3 && txt.length <= 160) return txt;
  }
  const classMatch = blockHtml.match(/<(?:div|p|span)[^>]*class=["'][^"']*(?:question-title|q-title|title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span)>/i);
  if (classMatch) {
    const txt = htmlToText(classMatch[1]).trim();
    if (txt.length >= 3 && txt.length <= 160) return txt;
  }
  const strongMatch = blockHtml.match(/^\s*<strong[^>]*>([\s\S]{3,160}?)<\/strong>/i);
  if (strongMatch) {
    const txt = htmlToText(strongMatch[1]).trim();
    if (txt.length >= 3 && txt.length <= 160 && !/[?.!]/.test(txt)) return txt;
  }
  return null;
}

// ─── Parse a single question block ─────────────────────────────────────────
function parseBlock(blockHtml: string, preferredDifficulty = "intermediate"): HtmlParsedQuestion | null {
  const text = htmlToText(blockHtml);
  const blockTitle = extractBlockTitle(blockHtml);

  const choices = parseChoicesFromText(text);
  if (choices.length < 2) return null;

  const stem = extractStem(text);
  if (!stem || stem.length < 10) return null;

  const answerKey = extractAnswerKey(blockHtml, text, choices);
  const { explanation, educationalObjective } = extractExplanation(text);

  // Images — only from THIS block
  const srcs = extractImgSrcs(blockHtml);
  const imagePath = srcs[0] || null;
  const imageCaption = imagePath ? (extractImgAlt(blockHtml) || null) : null;

  // Metadata
  const subject = extractInlineField(text, ["Subject", "System", "Organ system"]) || detectIfomSubject(stem + " " + text.slice(0, 400));
  const topic = extractInlineField(text, ["Topic", "Theme"]) || detectTopic(stem + " " + text.slice(0, 400), subject);
  const difficulty = detectDifficulty(stem + " " + explanation, preferredDifficulty);

  return {
    stem,
    choices,
    answer_key: choices.find(c => c.key === answerKey) ? answerKey : choices[0].key,
    explanation: educationalObjective
      ? `${explanation}\n\nEducational objective: ${educationalObjective}`
      : explanation,
    educational_objective: educationalObjective,
    image_path: imagePath,
    image_caption: imageCaption,
    subject,
    topic,
    difficulty,
    tags: [...new Set([blockTitle ? `title:${blockTitle}` : "", "IFOM CSE", subject, topic, difficulty].filter(Boolean))],
  };
}

function extractInlineField(text: string, labels: string[]): string {
  for (const label of labels) {
    const m = text.match(new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]{2,80})`, "i"));
    if (m?.[1]) return cleanLine(m[1]);
  }
  return "";
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse an HTML string from a question-bank export into structured questions.
 * Each question gets only the images that appear inside its own HTML block.
 * Text is verbatim from the source — no reformulation, no AI.
 *
 * @param html         Raw HTML string (from file upload or lesson html_body)
 * @param opts.count   Maximum number of questions to return (default 500)
 * @param opts.difficulty  Fallback difficulty label
 */
export function parseHtmlQuestions(
  html: string,
  opts: { count?: number; difficulty?: string } = {}
): HtmlParsedQuestion[] {
  const maxCount = opts.count ?? 500;
  const difficulty = opts.difficulty ?? "intermediate";

  // Isolate the <body> content if present
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const workHtml = bodyMatch ? bodyMatch[1] : html;

  const blocks = splitHtmlIntoQuestionBlocks(workHtml);
  const results: HtmlParsedQuestion[] = [];

  for (const block of blocks) {
    if (results.length >= maxCount) break;
    const q = parseBlock(block, difficulty);
    if (q) results.push(q);
  }

  return results;
}
