/**
 * Direct question importer — no AI required.
 * Parses JSON, JS, or any structured text file into question rows
 * exactly as written: stem, choices, answer key, explanation, images.
 */

export type DirectQuestion = {
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

const CHOICE_KEYS = ["A", "B", "C", "D", "E", "F"] as const;

function coerceString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Strip HTML tags from a string, preserving readability */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|li|tr|td|th|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Pull the Educational Objective out of an `<div class='objective'>…</div>` block */
function extractObjectiveBlock(html: string): string | null {
  const m = html.match(/<div[^>]+class=["'][^"']*objective[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  return htmlToPlainText(m[1]).replace(/^\s*educational\s*objective\s*:?\s*/i, "").trim() || null;
}

/** Pull the letter key out of "A. text", "A) text", "(A) text", "A: text", or just "A" */
function extractKey(raw: string): string | null {
  const m = raw.match(/^\s*\(?([A-Fa-f])\)?[\s.\-):]/);
  return m ? m[1].toUpperCase() : null;
}

/** Remove the leading "A. " / "A) " prefix from a choice string */
function stripKeyPrefix(raw: string): string {
  return raw.replace(/^\s*\(?[A-Fa-f]\)?[\s.\-):]+/, "").trim();
}

/**
 * Resolve the answer_key field — handles:
 *   - "A", "B", … (letter string)
 *   - 0, 1, 2, … (0-based index integer)
 *   - "A. Full answer text" (letter prefix then text)
 *   - "correct" / "true" boolean strings (assumes first option)
 */
function resolveAnswerKey(raw: unknown, choices: { key: string; text: string }[]): string {
  if (typeof raw === "number") {
    return choices[raw]?.key ?? choices[0]?.key ?? "A";
  }
  // Numeric digit stored as string (e.g. "4") → 0-based option index
  const trimmed = coerceString(raw).trim();
  if (/^\d+$/.test(trimmed)) {
    return choices[Number(trimmed)]?.key ?? choices[0]?.key ?? "A";
  }
  const s = coerceString(raw).toUpperCase();
  if (/^[A-F]$/.test(s)) return s;
  const fromPrefix = extractKey(raw as string);
  if (fromPrefix) return fromPrefix;
  // Try matching the text against choices
  const needle = coerceString(raw).toLowerCase();
  for (const c of choices) {
    if (c.text.toLowerCase().startsWith(needle.slice(0, 30))) return c.key;
  }
  return choices[0]?.key ?? "A";
}

/**
 * Normalise an array field that may arrive as:
 *   - string[] with optional "A. text" prefixes
 *   - {key,text}[] or {label,value}[] objects
 *   - {A: "text", B: "text"} plain object
 */
function normalizeChoices(raw: unknown): { key: string; text: string }[] {
  if (!raw) return [];

  // Plain object mapping {A: "...", B: "..."}
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, string>)
      .filter(([k]) => /^[A-Fa-f]$/.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k.toUpperCase(), text: coerceString(v) }));
  }

  if (!Array.isArray(raw)) return [];

  const arr = raw as unknown[];

  // Array of objects, or tuple pairs (quiz-app exports use [["A","text"]])
  if (arr.length && typeof arr[0] === "object" && arr[0] !== null) {
    return arr.map((item, idx) => {
      if (Array.isArray(item)) {
        const k = coerceString(item[0]).toUpperCase().slice(0, 1);
        const raw = coerceString(item[1]);
        const text = raw.replace(/^\s*\(?[A-Fa-f]\)?[.:\-)\s]+/, "").trim() || raw;
        return { key: CHOICE_KEYS.includes(k as (typeof CHOICE_KEYS)[number]) ? k : CHOICE_KEYS[idx] ?? "A", text };
      }
      const o = item as Record<string, unknown>;
      const text = coerceString(o.text ?? o.value ?? o.content ?? o.description ?? o.answer ?? o.option ?? o.label ?? "");
      const key = coerceString(o.key ?? o.letter ?? o.label ?? o.id ?? CHOICE_KEYS[idx] ?? "A").toUpperCase().slice(0, 1);
      return { key: CHOICE_KEYS.includes(key as (typeof CHOICE_KEYS)[number]) ? key : CHOICE_KEYS[idx] ?? "A", text };
    });
  }

  // Array of strings: "A. text", "A) text", or bare text
  const result: { key: string; text: string }[] = [];
  for (let i = 0; i < arr.length; i++) {
    const s = coerceString(arr[i]);
    const k = extractKey(s);
    result.push({ key: k ?? CHOICE_KEYS[i] ?? "A", text: k ? stripKeyPrefix(s) : s });
  }
  return result;
}

/** Normalise a single raw question object from any JSON format */
function normalizeOne(raw: Record<string, unknown>, fallbackDifficulty: string): DirectQuestion | null {
  let stem = coerceString(raw.stem ?? raw.question ?? raw.q ?? raw.text ?? raw.prompt ?? raw.vignette ?? raw.case ?? "");
  if (!stem) return null;
  if (/<[a-z][^>]*>/i.test(stem)) stem = htmlToPlainText(stem);

  const title = coerceString(raw.title ?? raw.heading ?? raw.name ?? "");
  // NOTE: we intentionally do NOT prepend the title to the stem anymore.
  // The title is stored via tags (title:<value>) and rendered separately
  // in the UI so it never bleeds into the question vignette.
  if (title && stem) {
    const lowerStem = stem.toLowerCase();
    const lowerTitle = title.toLowerCase();
    if (lowerStem.startsWith(lowerTitle + ".") || lowerStem.startsWith(lowerTitle + " —") || lowerStem.startsWith(lowerTitle + " -") || lowerStem.startsWith(lowerTitle + ":")) {
      // Strip a previously-embedded title prefix so old imports also normalise cleanly.
      stem = stem.slice(title.length).replace(/^[\s\-–—.:]+/, "").trim();
    }
  }

  const choices = normalizeChoices(raw.choices ?? raw.options ?? raw.answers ?? raw.variants ?? raw.items ?? raw.opts);
  if (choices.length < 2) return null;

  const answerRaw = raw.answer_key ?? raw.answer ?? raw.correct ?? raw.correct_answer ?? raw.correctAnswer ?? raw.key ?? raw.ans ?? raw.correctOption ?? raw.right ?? null;
  const answer_key = resolveAnswerKey(answerRaw, choices);

  let explanation = coerceString(raw.explanation ?? raw.rationale ?? raw.reason ?? raw.discussion ?? raw.exp ?? raw.feedback ?? raw.solution ?? raw.justification ?? "");
  if (/<[a-z][^>]*>/i.test(explanation)) {
    const objective = extractObjectiveBlock(explanation);
    const plain = htmlToPlainText(explanation).replace(/educational\s*objective\s*:[\s\S]*$/i, "").trim();
    explanation = objective ? `${plain}\n\nEducational Objective: ${objective}` : plain;
  }
  if (!explanation) explanation = "No explanation provided.";

  // Image — direct sources only; never accept template placeholders like "${q.image}"
  const rawImage = coerceString(
    raw.image_path ?? raw.image ?? raw.imageUrl ?? raw.image_url ?? raw.img ?? raw.imageLink ?? raw.figure ?? ""
  );
  const image_path =
    rawImage && !/\$\{/.test(rawImage) && /^(https?:|data:|blob:|\/)/i.test(rawImage.trim())
      ? rawImage.trim()
      : null;
  const image_caption = coerceString(
    raw.image_caption ?? raw.imageCaption ?? raw.caption ?? raw.img_caption ?? raw.figureCaption ?? ""
  ) || null;

  // Difficulty
  const diffRaw = coerceString(raw.difficulty ?? raw.level ?? raw.complexity ?? fallbackDifficulty).toLowerCase();
  const difficulty = ["foundation", "intermediate", "advanced", "expert"].includes(diffRaw) ? diffRaw : fallbackDifficulty;

  // Tags
  const tagsRaw = raw.tags ?? raw.keywords ?? raw.categories ?? raw.labels ?? [];
  const tags: string[] = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => coerceString(t)).filter(Boolean)
    : coerceString(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean);

  // Subject / system / topic (optional metadata)
  const subject = coerceString(raw.subject ?? raw.category ?? raw.system ?? raw.specialty ?? "");
  const system = coerceString(raw.system ?? raw.organ_system ?? raw.organSystem ?? subject ?? "");
  const topic = coerceString(raw.topic ?? raw.theme ?? raw.subtopic ?? "");

  const finalTags = title ? [`title:${title}`, ...tags] : tags;
  return { stem, choices, answer_key, explanation, image_path, image_caption, difficulty, tags: finalTags, subject, system, topic };
}

/**
 * Extract a JS/TS array literal from source text.
 * Handles: `const x = [...]`, `export default [...]`, `module.exports = [...]`
 */
function extractJsonFromJs(text: string): string | null {
  // Try to find the first top-level array
  const arrayStart = text.search(/\[\s*\{/);
  if (arrayStart === -1) return null;
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escape = false;
  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (inString) { if (ch === stringChar) inString = false; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = true; stringChar = ch; continue; }
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        const raw = text.slice(arrayStart, i + 1);
        // The embedded quiz-app exports are already valid JSON — the previous
        // apostrophe-replacement corrupted double-quoted strings like "I'm"
        // into a syntax error. Try the slice as-is first.
        try { JSON.parse(raw); return raw; } catch { /* needs JS→JSON normalisation */ }
        let slice = raw.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => `"${inner.replace(/"/g, '\\"')}"`);
        slice = slice.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        slice = slice.replace(/,(\s*[}\]])/g, "$1");
        return slice;
      }
    }
  }
  return null;
}

/**
 * Parse a file's text content into DirectQuestion[].
 * Supports JSON arrays, JS module exports, and plain structured text.
 */
export function parseDirectImportFile(
  text: string,
  filename: string,
  fallbackDifficulty = "intermediate"
): DirectQuestion[] {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  let parsed: unknown = null;

  // 1. Try direct JSON parse
  try {
    parsed = JSON.parse(text);
  } catch {
    // 2. Try extracting JSON array from JS/TS source
    if (["js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext) || !parsed) {
      const extracted = extractJsonFromJs(text);
      if (extracted) {
        try { parsed = JSON.parse(extracted); } catch { /* fall through */ }
      }
    }
  }

  if (!parsed) return [];

  // Unwrap {questions: [...]} envelope
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const key = ["questions", "items", "data", "records", "qbank", "bank"].find((k) => Array.isArray(obj[k]));
    if (key) arr = obj[key] as unknown[];
    else arr = [parsed]; // single question object
  }

  return arr
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => normalizeOne(item, fallbackDifficulty))
    .filter((q): q is DirectQuestion => q !== null);
}
