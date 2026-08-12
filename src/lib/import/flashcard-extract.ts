/**
 * Real Medical Flashcard Extraction Engine — NO AI required.
 * Extracts high-yield flashcards directly from source document text.
 * Preserves original wording. Never generates placeholder content.
 *
 * Extraction strategies (in order):
 *  0. Explicit structured flashcards (PART / TITLE / FRONT / BACK)
 *  1. Structured key-value blocks (Definition:, Features:, Treatment:, etc.)
 *  2. Header + bullet-point lists
 *  3. Medical fact sentences (condition + characteristic pattern)
 *  4. Lab value patterns
 */

import { parseStructuredFlashcards, upsertFlashcardTitleTag } from "@/lib/flashcards/structured";

export type ExtractedFlashcard = {
  front: string;
  back: string;
  tags: string[];
  section?: string | null;
};

// ─── Text preprocessing ───────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isNoise(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (l.length < 4) return true;
  if (/^(page\s+\d+|slide\s+\d+|\d+\s*\/\s*\d+|copyright|all rights reserved|www\.|http)/.test(l)) return true;
  if (/^(focus:|high-yield explanation|session summary|ai generated|pipeline example|sample content|educational explanation)/i.test(l)) return true;
  return false;
}

function makeBullets(items: string[]): string {
  return items.filter(Boolean).map(s => `• ${s.trim()}`).join("\n");
}

// ─── Strategy 1: Labelled blocks (Definition:, Features:, Management:, etc.) ──

const LABEL_PATTERNS = [
  /^(definition|definition of|defined as)\s*[:\-]\s*/i,
  /^(features?|clinical features?|characteristic features?)\s*[:\-]\s*/i,
  /^(presentation|presents? with|clinical presentation)\s*[:\-]\s*/i,
  /^(symptoms?|signs?|manifestations?)\s*[:\-]\s*/i,
  /^(treatment|management|therapy|first.?line)\s*[:\-]\s*/i,
  /^(diagnosis|investigations?|workup)\s*[:\-]\s*/i,
  /^(mechanism|pathophysiology|pathogenesis)\s*[:\-]\s*/i,
  /^(complications?|sequelae)\s*[:\-]\s*/i,
  /^(epidemiology|risk factors?)\s*[:\-]\s*/i,
  /^(prognosis|outcome)\s*[:\-]\s*/i,
  /^(cause[sd]? by|etiology|aetiology)\s*[:\-]\s*/i,
  /^(lab(?:oratory)? findings?|lab(?:oratory)? values?)\s*[:\-]\s*/i,
  /^(drug|drugs?|medication)\s*[:\-]\s*/i,
  /^(dose|dosing|side effects?|adverse effects?)\s*[:\-]\s*/i,
  /^(note|key point|high.?yield|important)\s*[:\-]\s*/i,
];

function isLabel(line: string): string | null {
  for (const pattern of LABEL_PATTERNS) {
    const m = line.match(pattern);
    if (m) return line.slice(m[0].length).trim();
  }
  return null;
}

// ─── Strategy 2: Header + content blocks ─────────────────────────────────────

function scoreHeading(line: string): number {
  if (!line || line.length > 80) return 0;
  let score = 0;
  if (/^[A-Z][A-Z\s\-\/&,0-9]{3,}$/.test(line)) score += 3; // ALL CAPS
  if (/^[A-Z][A-Za-z\s\-\/&,0-9]{2,}:$/.test(line)) score += 2; // Title:
  if (/^(?:\d+\.|\*|•|-)\s+[A-Z]/.test(line)) score += 1;
  if (/(?:anemia|disease|syndrome|disorder|deficiency|infection|failure|cancer|tumor|carcinoma|management|diagnosis|treatment|etiology|pathophysiology|mechanism|epidemiology|complication|presentation|features?|signs?|symptoms?)/i.test(line)) score += 2;
  return score;
}

// ─── Strategy 3: Lab/numerical value patterns ────────────────────────────────
const FACT_PATTERNS: RegExp[] = [
  // Pattern disabled; structured extraction (PART/TITLE/FRONT/BACK) handles sources.
];

function extractLabFacts(text: string): string[] {
  const results: string[] = [];
  const regex = /([A-Za-z‐-]+(?:\s+[a-z]+)?)\s*(↑|↓|increased|decreased|elevated|reduced|low|high|positive|negative)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const head = m[1].trim();
    if (head.length < 2) continue;
    results.push(`${head}: ${m[2].toLowerCase()}`);
  }
  return Array.from(new Set(results));
}

export function extractFlashcardsFromText(
  rawText: string,
  opts: { isHtml?: boolean; maxCards?: number; tags?: string[] } = {}
): ExtractedFlashcard[] {
  const maxCards = Math.max(1, Math.min(opts.maxCards ?? 80, 200));
  const defaultTags = opts.tags ?? [];

  const text = opts.isHtml ? stripHtml(rawText) : rawText;

  const structured = parseStructuredFlashcards(text);
  if (structured.length) {
    return structured.slice(0, maxCards).map((card) => ({
      front: card.front,
      back: card.back,
      section: card.section,
      tags: upsertFlashcardTitleTag(defaultTags, card.title),
    }));
  }

  const lines = text.split("\n").map(cleanLine).filter(l => l && !isNoise(l));

  const cards: ExtractedFlashcard[] = [];
  const seen = new Set<string>();

  function addCard(front: string, back: string, extraTags: string[] = [], section?: string | null) {
    if (cards.length >= maxCards) return;
    front = front.trim().replace(/[:.\-]+$/, "").trim();
    back = back.trim();
    if (!front || !back || front.length < 3 || back.length < 4) return;
    if (front.length > 150) front = front.slice(0, 147) + "…";
    const key = front.toLowerCase().slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ front, back, section: section ?? null, tags: [...new Set([...defaultTags, ...extraTags])] });
  }

  // ── Pass 1: Labelled blocks ──────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const colonIdx = line.search(/\s*[:\-]\s+/);
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const content = line.slice(colonIdx).replace(/^\s*[:\-]\s*/, "").trim();

      if (label.length >= 4 && label.length <= 80 && content.length >= 6) {
        if (/^[A-Z]/.test(label) && scoreHeading(label + ":") >= 1) {
          const bullets: string[] = [];
          for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
            const next = lines[j];
            if (next.startsWith("•") || /^[A-Z]/.test(next)) bullets.push(next.includes("•") ? next.replace(/^•\s*/, "") : next);
            else break;
          }
          if (bullets.length >= 2) {
            addCard(label, makeBullets(bullets.slice(0, 6)));
            i += bullets.length;
            continue;
          }
        }
      }
    }
  }

  // ── Pass 2: Heading + body ───────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i];
    if (scoreHeading(heading) < 4) continue;
    const bodyLines: string[] = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
      const next = lines[j];
      if (!next) continue;
      if (scoreHeading(next) >= 3) break;
      bodyLines.push(next);
    }
    if (!bodyLines.length) continue;
    const back = bodyLines.length === 1
      ? bodyLines[0]
      : makeBullets(bodyLines.slice(0, 8));
    addCard(heading, back);
  }

  // ── Pass 3: Sentence-based patterns ──────────────────────────────────────────
  const fullText = lines.join(" ");
  for (const pattern of FACT_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(fullText)) !== null && cards.length < maxCards) {
      const front = m[1].trim();
      const back = m[2].trim();
      if (front.length >= 4 && back.length >= 6) addCard(front, back);
    }
  }

  // ── Pass 4: Lab value groups ──────────────────────────────────────────────────
  const paragraphs = fullText.split(/\n{2,}/);
  for (const para of paragraphs) {
    const labFacts = extractLabFacts(para);
    if (labFacts.length >= 2) {
      const firstSentence = para.split(/[.!?]/)[0]?.trim() || "";
      const condition = firstSentence.match(/([A-Z][A-Za-z\s\-]+(?:anemia|syndrome|disease|disorder|deficiency|cancer|failure|infection))/)?.[1];
      const front = condition || (firstSentence.length > 8 && firstSentence.length < 80 ? firstSentence : null);
      if (front) addCard(front + " — lab findings", makeBullets(labFacts.slice(0, 8)));
    }
  }

  return cards;
}
