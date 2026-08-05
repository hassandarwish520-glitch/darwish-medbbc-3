/**
 * Normalizes questions from Supabase that may have been imported incorrectly.
 *
 * Some questions were imported with the entire HTML/JS quiz runner code stored
 * as the `stem` field. This module detects those cases and extracts the real
 * question data from the embedded JSON/JS.
 *
 * Also converts old-format questions (options[], answer: number) to the
 * expected format (choices[], answer_key: string).
 *
 * repairChoices() strips any choice whose text is a UI button label that was
 * accidentally stored as a question option (e.g. "Submit", "Reveal Answer").
 */

/**
 * Patterns that indicate a choice text is actually a UI button label that was
 * accidentally stored as a question option during import (full-text match).
 */
const BUTTON_TEXT_RE =
  /^(submit|submit\s*answer|reveal\s*answer|check\s*answer|next|next\s*question|show\s*answer|confirm|done|finish|continue|correct|wrong|reset|correct\s*wrong|submit\s*reset|correct\s*wrong\s*submit\s*reset)$/i;

/**
 * Strips ONE trailing UI button token from the end of a choice text.
 * Called in a loop to peel off chains like "Correct Wrong Submit Reset".
 * Handles optional whitespace, percentage stats like "(9.0%)", and common labels.
 */
const TRAILING_BUTTON_TOKEN_RE =
  /[\s·•\-–—]*(?:\(\d+(?:\.\d+)?%\)\s*)?\b(correct|wrong|reset|submit|submit\s+answer|reveal\s+answer|check\s+answer|show\s+answer|next\s+question|confirm|done|finish|continue)\s*$/i;

/**
 * Repeatedly strips trailing button tokens until no more remain.
 * Handles chains like "Some choice text Correct Wrong Submit Reset".
 */
function stripTrailingButtons(text: string): string {
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(TRAILING_BUTTON_TOKEN_RE, "").trim();
  }
  return text;
}

/**
 * Strips a concatenated next-choice label from the end of a choice text.
 * e.g. "D-dimer test F. Empiric anticoagulation" → "D-dimer test"
 * This happens when the importer failed to split two adjacent choice lines,
 * leaving the next choice's key + period + text appended to the previous choice.
 * Only matches when the appended part looks like a real choice prefix:
 *   – space(s) + uppercase letter A-Z + period + space + capital letter + lowercase
 * Extended from A-G to A-Z to handle questions with more than 7 choices.
 */
const TRAILING_NEXT_CHOICE_RE =
  /\s+[A-Z]\.\s+[A-Z][a-z][\w\s,\-().'/:;]{1,300}$/;

/**
 * Detects and splits a choice text that has multiple choices concatenated with
 * "Correct Wrong [Letter]" (or "Correct [Letter]" / "Wrong [Letter]") separators.
 * This is an import artifact where the quiz runner's button labels and next-choice
 * markers were merged into a single text field during scraping.
 *
 * Example input:
 *   "Serum chemistry profile and urinalysis Correct Wrong F Serum TSH level Correct Wrong G Urine toxicology screen"
 * Output:
 *   ["Serum chemistry profile and urinalysis", "Serum TSH level", "Urine toxicology screen"]
 *
 * Extended from [A-G] to [A-Z] so that questions with choices H, I, J... are
 * handled correctly (previously choices beyond G were merged into the last visible choice).
 *
 * The lookahead (?=[A-Z]) ensures the letter is followed by the start of real text
 * (uppercase), so common words like "correct" or "wrong" alone don't create false splits.
 */
function splitConcatenatedChoices(text: string): string[] {
  const parts = text.split(/\s+(?:(?:correct|wrong)\s+){1,2}[A-Z]\s+(?=[A-Z])/i);
  if (parts.length <= 1) return [text];
  return parts
    .map((p) => stripTrailingButtons(p.trim()))
    .filter((p) => p.length > 2 && !BUTTON_TEXT_RE.test(p));
}

/**
 * Maximum characters a valid MCQ answer choice should contain.
 * Choices longer than this are almost certainly the question stem text that
 * was accidentally stored as a choice during import.
 */
const MAX_CHOICE_LENGTH = 400;

/**
 * Returns true if the text looks like a short topic/subject header rather than
 * a clinical question stem (no question mark, no patient scenario keywords).
 */
function isTopicHeader(text: string): boolean {
  const t = text.trim();
  return (
    t.length < 130 &&
    !t.includes("?") &&
    !/\b(year-old|comes to|presents to|brought to|history of|physical exam|vital signs|laboratory|which of the following)\b/i.test(t)
  );
}

/**
 * Remove choices whose text matches known UI button labels or are too short
 * to be real answer options. Also:
 *   – strips trailing button text (e.g. "…(9.0%) Submit")
 *   – strips a concatenated next-choice label (e.g. " F. Empiric anticoagulation")
 *   – filters out choices that are too long to be a real answer (likely the
 *     question stem accidentally stored as a choice)
 * Reassigns consecutive letter keys (A, B, C …) after filtering so the
 * answer_key reference stays valid.
 */
export function repairChoices(
  choices: { key: string; text: string }[],
  answer_key: string,
): { choices: { key: string; text: string }[]; answer_key: string } {
  // Find the original text of the correct answer before any cleaning
  const correctText = choices.find((c) => c.key === answer_key)?.text ?? "";

  // First pass: strip trailing junk and expand any concatenated multi-choices.
  // Some imports merge several choices into one text with "Correct Wrong F …" inline
  // separators (e.g. "…urinalysis Correct Wrong F Serum TSH level Correct Wrong G Urine…").
  // splitConcatenatedChoices detects and splits those; then each sub-text also gets
  // TRAILING_NEXT_CHOICE_RE + stripTrailingButtons applied.
  const stripped: { key: string; text: string }[] = [];
  for (const c of choices) {
    const baseText = c.text.replace(TRAILING_NEXT_CHOICE_RE, "").trim();
    const subTexts = splitConcatenatedChoices(baseText);
    for (const sub of subTexts) {
      stripped.push({ key: c.key, text: stripTrailingButtons(sub) });
    }
  }

  // Second pass: drop choices that are too short, are button labels, or are so
  // long that they are almost certainly the question stem stored as a choice.
  const filtered = stripped.filter((c) => {
    const text = c.text.trim();
    return (
      text.length > 2 &&
      text.length <= MAX_CHOICE_LENGTH &&
      !BUTTON_TEXT_RE.test(text)
    );
  });

  // Reassign keys A, B, C … sequentially
  const repaired = filtered.map((c, i) => ({ key: String.fromCharCode(65 + i), text: c.text }));

  // Remap answer_key: prefer matching the cleaned correct text; fall back to
  // the original key if it survived (e.g. the correct choice had no trailing junk).
  const cleanedCorrect = stripTrailingButtons(
    correctText.replace(TRAILING_NEXT_CHOICE_RE, "").trim()
  );
  const newKey =
    repaired.find((c) => c.text === cleanedCorrect)?.key ??
    repaired.find((c) => c.text === correctText)?.key ??
    answer_key;

  return { choices: repaired, answer_key: newKey };
}

/**
 * Full-question repair: handles the case where the real question stem was
 * accidentally stored as choice A during import, leaving the actual stem field
 * as only a short topic header (e.g. "Internal Medicine · Hematology & Oncology").
 *
 * When detected, choice A's text is promoted to the stem, choice A is removed,
 * and the remaining choices are re-keyed starting from A.
 */
export function repairQuestion(q: NormalizedQuestion): NormalizedQuestion {
  const firstChoice = q.choices[0];

  const shouldLift =
    firstChoice &&
    firstChoice.text.length > 80 &&
    isTopicHeader(q.stem);

  if (!shouldLift) {
    const { choices, answer_key } = repairChoices(q.choices, q.answer_key);
    return { ...q, choices, answer_key };
  }

  // Lift choice A → stem; drop it from the choices array then re-key
  const liftedStem = firstChoice.text;
  const remainingChoices = q.choices.slice(1);

  // If the answer was pointing at the removed choice A, reset to the first
  // surviving choice so we don't silently keep an invalid key.
  const survivingAnswerKey =
    q.answer_key === firstChoice.key
      ? (remainingChoices[0]?.key ?? q.answer_key)
      : q.answer_key;

  const { choices, answer_key } = repairChoices(remainingChoices, survivingAnswerKey);
  return { ...q, stem: liftedStem, choices, answer_key };
}

export type NormalizedQuestion = {
  id: string;
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string | null;
  difficulty: string;
  tags: string[];
  image_path?: string | null;
  image_caption?: string | null;
};

/** Convert an old-format question object to NormalizedQuestion */
function convertOldFormat(q: Record<string, unknown>, baseId: string, idx: number): NormalizedQuestion | null {
  const stem = typeof q.stem === "string" ? q.stem.trim() : "";
  if (!stem || stem.length < 8) return null;

  const options: unknown[] = Array.isArray(q.options) ? q.options : [];
  const choices = options
    .map((opt, i) => ({ key: String.fromCharCode(65 + i), text: String(opt).trim() }))
    .filter((c) => Boolean(c.text));

  if (choices.length < 2) return null;

  const answerNum = typeof q.answer === "number" ? q.answer : 1;
  const answerIdx = Math.max(0, Math.min(answerNum - 1, choices.length - 1));
  const answer_key = choices[answerIdx]?.key ?? "A";

  const explanationParts: string[] = [];
  if (q.objective && String(q.objective).trim()) explanationParts.push(String(q.objective).trim());
  if (q.extra && String(q.extra).trim()) {
    if (explanationParts.length) {
      explanationParts.push(`\n\nEducational objective: ${String(q.extra).trim()}`);
    } else {
      explanationParts.push(String(q.extra).trim());
    }
  }
  const explanation = explanationParts.length ? explanationParts.join("") : null;

  const topic = typeof q.topic === "string" ? q.topic.trim() : "";

  return {
    id: `${baseId}-${String(q.id ?? idx)}`,
    stem,
    choices,
    answer_key,
    explanation,
    difficulty: "intermediate",
    tags: ["IFOM CSE", ...(topic ? [topic] : [])].filter(Boolean),
    image_path: null,
    image_caption: null,
  };
}

/** Check if a stem value looks like embedded JS/JSON quiz code rather than a real question */
function isEmbeddedCode(stem: string): boolean {
  if (stem.length > 2000) return true;
  if (stem.includes("const QUESTIONS") || stem.includes("var QUESTIONS") || stem.includes("let QUESTIONS")) return true;
  if (stem.includes("function renderQuestion") || stem.includes("function shuffle(")) return true;
  if (stem.includes("addEventListener(")) return true;
  if (stem.includes('"id":') && stem.includes('"stem":') && stem.includes('"options":')) return true;
  if (stem.includes("QUESTION BANK") && stem.includes("const QUESTIONS")) return true;
  return false;
}

/** Extract questions from a stem that contains embedded JSON/JS question data */
function extractEmbeddedQuestions(stem: string, baseId: string): NormalizedQuestion[] {
  // Pattern 1: const/var/let QUESTIONS = [...]
  const jsMatch = stem.match(/(?:const|var|let)\s+QUESTIONS\s*=\s*(\[[\s\S]*?\])\s*;/);
  let jsonStr = jsMatch?.[1] ?? "";

  // Pattern 2: raw JSON array starting with [{"id":
  if (!jsonStr) {
    const arrStart = stem.indexOf('[{"id"');
    if (arrStart >= 0) {
      let depth = 0;
      let end = arrStart;
      for (let i = arrStart; i < stem.length; i++) {
        const ch = stem[i];
        if (ch === "[" || ch === "{") depth++;
        else if (ch === "]" || ch === "}") {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > arrStart) jsonStr = stem.slice(arrStart, end);
    }
  }

  if (!jsonStr) return [];

  try {
    const data: unknown = JSON.parse(jsonStr);
    if (!Array.isArray(data)) return [];
    return (data as Record<string, unknown>[])
      .map((q, i) => convertOldFormat(q, baseId, i))
      .filter((q): q is NormalizedQuestion => q !== null);
  } catch {
    return [];
  }
}

/** Detect whether a row has valid data already (stem is clean, choices is a proper array) */
function isValidRow(row: Record<string, unknown>): boolean {
  const stem = row.stem;
  if (typeof stem !== "string" || stem.length < 8) return false;
  if (isEmbeddedCode(stem)) return false;
  const choices = row.choices;
  if (!Array.isArray(choices) || choices.length < 2) return false;
  if (typeof (choices[0] as Record<string, unknown>)?.key !== "string") return false;
  return true;
}

/**
 * Normalize an array of questions from Supabase.
 * Handles three cases:
 *   1. Valid rows with clean stem + choices[]  → used as-is
 *   2. Rows whose stem contains embedded JS/JSON question data → extracted + converted
 *   3. Rows with old format (options[], answer: number) but clean stem → converted
 */
export function normalizeQuestions(rows: unknown[]): NormalizedQuestion[] {
  const result: NormalizedQuestion[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const rowId = String(row.id ?? "row");

    // Case 1: Already valid
    if (isValidRow(row)) {
      const q = row as unknown as NormalizedQuestion;
      result.push(repairQuestion(q));
      continue;
    }

    const stem = typeof row.stem === "string" ? row.stem : "";

    // Case 2: Stem contains embedded code/JSON
    if (stem && isEmbeddedCode(stem)) {
      const embedded = extractEmbeddedQuestions(stem, rowId);
      if (embedded.length) {
        result.push(...embedded.map(repairQuestion));
        continue;
      }
    }

    // Case 3: Old format with options[] and numeric answer
    if (Array.isArray(row.options) && typeof row.answer === "number") {
      const converted = convertOldFormat(row, rowId, 0);
      if (converted) {
        result.push(repairQuestion(converted));
        continue;
      }
    }

    // If none of the above worked, skip the row (don't add garbage)
  }

  return result;
}
