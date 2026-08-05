/**
 * Real Medical Flashcard Extraction Engine — NO AI required.
 * Extracts high-yield flashcards directly from source document text.
 * Preserves original wording. Never generates placeholder content.
 *
 * Extraction strategies (in order):
 *  1. Structured key-value blocks (Definition:, Features:, Treatment:, etc.)
 *  2. Header + bullet-point lists
 *  3. Medical fact sentences (condition + characteristic pattern)
 *  4. Lab value patterns
 */

export type ExtractedFlashcard = {
  front: string;
  back: string;
  tags: string[];
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

// ─── Strategy 3: Lab/numerical value patterns ─────────────────────────────────

const LAB_PATTERN = /([↑↓⬆⬇]\s*[A-Za-z][A-Za-z0-9\s\-\/]+(?:level|count|concentration|ratio|saturation|activity)?)\s*(?:[,;]|$)/gi;

function extractLabFacts(text: string): string[] {
  const facts: string[] = [];
  const matches = [...text.matchAll(LAB_PATTERN)];
  for (const m of matches) {
    const fact = m[1].trim().replace(/\s+/g, " ");
    if (fact.length > 4 && fact.length < 60) facts.push(fact);
  }
  return [...new Set(facts)];
}

// ─── Strategy 4: Sentence-based fact extraction ───────────────────────────────

const FACT_PATTERNS = [
  /([A-Z][A-Za-z\s\-]+(?:anemia|syndrome|disease|disorder|deficiency|cancer|failure|infection|tumor|carcinoma))\s+(?:is|are)\s+(?:characterized|defined|associated|caused)\s+by\s+([^.]{20,120})/gi,
  /([A-Z][A-Za-z\s\-]+)\s+(?:is|are)\s+the\s+(?:most\s+common\s+cause|first.?line|gold\s+standard|treatment\s+of\s+choice)\s+(?:of|for)\s+([^.]{10,80})/gi,
  /(?:Treatment|Management|First.?line)\s+(?:of|for)\s+([A-Za-z\s\-]+(?:anemia|syndrome|disease|disorder|deficiency|infection|failure))\s+(?:is|includes?)\s+([^.]{10,100})/gi,
];

// ─── Main extraction function ──────────────────────────────────────────────────

export function extractFlashcardsFromText(
  rawText: string,
  opts: { isHtml?: boolean; maxCards?: number; tags?: string[] } = {}
): ExtractedFlashcard[] {
  const maxCards = Math.min(opts.maxCards ?? 50, 100);
  const defaultTags = opts.tags ?? [];

  const text = opts.isHtml ? stripHtml(rawText) : rawText;
  const lines = text.split("\n").map(cleanLine).filter(l => l && !isNoise(l));

  const cards: ExtractedFlashcard[] = [];
  const seen = new Set<string>();

  function addCard(front: string, back: string, extraTags: string[] = []) {
    if (cards.length >= maxCards) return;
    front = front.trim().replace(/[:.\-]+$/, "").trim();
    back = back.trim();
    if (!front || !back || front.length < 3 || back.length < 4) return;
    if (front.length > 150) front = front.slice(0, 147) + "…";
    const key = front.toLowerCase().slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    cards.push({ front, back, tags: [...new Set([...defaultTags, ...extraTags])] });
  }

  // ── Pass 1: Labelled blocks ──────────────────────────────────────────────────
  // Find lines like "Features: X, Y, Z" or multi-line "Features:\n• X\n• Y"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line has a colon-separated label+content on one line
    const colonIdx = line.search(/\s*[:\-]\s+/);
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const content = line.slice(colonIdx).replace(/^\s*[:\-]\s*/, "").trim();

      // "Condition: feature list" where label is a medical condition/concept
      if (label.length >= 4 && label.length <= 80 && content.length >= 6) {
        // Gather continuation lines (bullet points or continuation sentences)
        const continuation: string[] = [content];
        let j = i + 1;
        while (j < lines.length && j < i + 8) {
          const next = lines[j].trim();
          if (!next || scoreHeading(next) >= 2) break;
          if (/^[•\-\*]/.test(next) || /^[A-Z]{1,2}[\)\.]\s/.test(next)) {
            continuation.push(next.replace(/^[•\-\*]\s*/, "").replace(/^[A-Z]{1,2}[\)\.]\s*/, ""));
            j++;
          } else if (next.match(/^\s/) || next.match(/^(and|or|also|including|such as)/i)) {
            continuation.push(next);
            j++;
          } else {
            break;
          }
        }

        const back = continuation.length > 1
          ? makeBullets(continuation)
          : continuation[0];

        addCard(label, back);
      }
    }
  }

  // ── Pass 2: Heading + following content ──────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (scoreHeading(line) < 2) continue;
    const heading = line.replace(/:$/, "").trim();
    if (heading.length < 4 || heading.length > 100) continue;

    // Collect following content lines as bullet points for the back
    const bodyLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && j < i + 12) {
      const next = lines[j].trim();
      if (!next) { j++; continue; }
      if (scoreHeading(next) >= 2 && bodyLines.length >= 1) break;
      if (!isNoise(next)) bodyLines.push(next.replace(/^[•\-\*]\s*/, ""));
      j++;
    }

    if (bodyLines.length >= 1) {
      const back = bodyLines.length === 1
        ? bodyLines[0]
        : makeBullets(bodyLines.slice(0, 8));
      addCard(heading, back);
    }
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
  // Look for paragraphs that have multiple ↑↓ patterns and group them under
  // the nearest heading
  const paragraphs = fullText.split(/\n{2,}/);
  for (const para of paragraphs) {
    const labFacts = extractLabFacts(para);
    if (labFacts.length >= 2) {
      // Find the best subject for this group — use the first sentence or detect a medical condition
      const firstSentence = para.split(/[.!?]/)[0]?.trim() || "";
      const condition = firstSentence.match(/([A-Z][A-Za-z\s\-]+(?:anemia|syndrome|disease|disorder|deficiency|cancer|failure|infection))/)?.[1];
      const front = condition || (firstSentence.length > 8 && firstSentence.length < 80 ? firstSentence : null);
      if (front) addCard(front + " — lab findings", makeBullets(labFacts.slice(0, 8)));
    }
  }

  return cards;
}
