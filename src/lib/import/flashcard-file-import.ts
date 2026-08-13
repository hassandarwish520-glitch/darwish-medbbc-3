import { parseStructuredFlashcards, upsertFlashcardTitleTag } from "@/lib/flashcards/structured";
import { structureBackText } from "@/lib/flashcards/structure";

export type ImportedFlashcardInput = {
  front: string;
  back: string;
  section?: string | null;
  title?: string | null;
  tags?: string[];
  high_yield?: string | null;
  clinical_pearl?: string | null;
  memory_tip?: string | null;
  references?: string[];
  difficulty?: string | number | null;
  source?: string | null;
  image_url?: string | null;
  primary_answer?: string | null;
  murmur?: string | null;
  key_finding?: string | null;
  etiology?: string | null;
  causes?: string[];
  triggers?: string[];
  consequences?: string[];
};

export type PreparedImportedFlashcard = {
  front: string;
  back: string;
  section: string | null;
  tags: string[];
  high_yield: string | null;
  clinical_pearl: string | null;
  memory_tip: string | null;
  references: string[];
  difficulty: "easy" | "medium" | "hard";
  source: string | null;
  image_url: string | null;
  title: string | null;
};

function clean(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripBullet(line: string) {
  return clean(line.replace(/^[•\-*◦▪►▸›»\s]+/, ""));
}

function uniq(values: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = clean(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeDifficulty(value: string | number | null | undefined): "easy" | "medium" | "hard" {
  if (typeof value === "number") {
    if (value <= 1.75) return "easy";
    if (value >= 2.75) return "hard";
    return "medium";
  }
  const raw = clean(String(value ?? "")).toLowerCase();
  if (!raw) return "medium";
  if (["easy", "foundation", "basic", "low"].includes(raw)) return "easy";
  if (["hard", "advanced", "high", "difficult"].includes(raw)) return "hard";
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return normalizeDifficulty(numeric);
  return "medium";
}

function tokenizeDelimited(text: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => clean(cell))) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((cell) => clean(cell))) rows.push(row);
  return rows;
}

function parseCsvLike(text: string, delimiter: "," | "\t") {
  const rows = tokenizeDelimited(text, delimiter);
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => clean(cell).toLowerCase());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = clean(cells[idx] ?? "");
    });
    return obj;
  });
}

function asList(value: unknown) {
  if (Array.isArray(value)) return uniq(value.map((item) => clean(String(item ?? ""))));
  const raw = clean(String(value ?? ""));
  if (!raw) return [];
  return uniq(raw.split(/\s*[;|]\s*|\s*,\s*/g));
}

function looksLikeJsonCards(text: string) {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function looksLikeDeckMarkdown(text: string) {
  return /\*\*Front:\*\*/i.test(text) && /\*\*Back:\*\*/i.test(text);
}

function pickFirst(lines: string[], rx: RegExp) {
  return lines.find((line) => rx.test(line)) ?? null;
}

function composeNormalizedBack(args: {
  primaryAnswer?: string | null;
  murmur?: string | null;
  keyFinding?: string | null;
  etiology?: string | null;
  causes?: string[];
  triggers?: string[];
  consequences?: string[];
  extras?: string[];
}) {
  const lines: string[] = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = clean(value);
    if (v) lines.push(`${label}: ${v}`);
  };
  push("Primary Answer", args.primaryAnswer);
  push("Murmur", args.murmur);
  push("Key Finding", args.keyFinding);
  push("Etiology", args.etiology);
  for (const item of uniq(args.causes ?? [])) push("Cause", item);
  for (const item of uniq(args.triggers ?? [])) push("Trigger", item);
  for (const item of uniq(args.consequences ?? [])) push("Consequence", item);
  for (const item of uniq(args.extras ?? [])) push("Key Point", item);
  return uniq(lines).join("\n");
}

function enrichFromBack(input: ImportedFlashcardInput): PreparedImportedFlashcard {
  const title = clean(input.title);
  const front = clean(input.front);
  const rawBack = clean(input.back);
  const rawLines = uniq(
    rawBack
      .split(/\n+/)
      .map(stripBullet)
      .filter(Boolean),
  );

  const primaryAnswer = clean(
    input.primary_answer ||
      pickFirst(rawLines, /low-pitched|crescendo|holosystolic|pansystolic|stable angina|unstable angina|nstemi|stemi|papillary muscle rupture|ventricular septal rupture|tamponade|ventricular aneurysm/i) ||
      rawLines[0] ||
      "",
  );

  const murmur = clean(
    input.murmur ||
      pickFirst(rawLines, /murmur|rumble|holosystolic|pansystolic|crescendo|decrescendo/i) ||
      "",
  );

  const keyFinding = clean(
    input.key_finding ||
      pickFirst(rawLines, /opening snap|best heard|radiates|pulsus|st depression|st elevation|q waves|hyperacute|troponin|triad|tricuspid valve|osler|janeway/i) ||
      "",
  );

  const etiology = clean(
    input.etiology ||
      pickFirst(rawLines, /rheumatic|degenerative|bicuspid|atherosclerotic|plaque rupture|occlusion|endocarditis|organisms|subendocardial|transmural/i) ||
      "",
  );

  const causes = uniq([
    ...(input.causes ?? []),
    ...rawLines.filter((line) => /(^|\b)(cause|causes|etiology|triggered by|organism|organisms|prosthetic valve|dental procedure|gi\/gu|iv drug use|bicuspid|degenerative|rheumatic)/i.test(line)),
  ]);

  const triggers = uniq([
    ...(input.triggers ?? []),
    ...rawLines.filter((line) => /(exertion|cold|emotional stress|rest angina|worsening angina|new-onset angina)/i.test(line)),
  ]);

  const consequences = uniq([
    ...(input.consequences ?? []),
    ...rawLines.filter((line) => /(→|->|leads to|progression|embolization|stroke risk|hypertension|hypertrophy|failure|tamponade|aneurysm|atrial fibrillation|left atrial|pulmonary edema|mural thrombus)/i.test(line)),
  ]);

  const consumed = new Set(
    uniq([
      primaryAnswer,
      murmur,
      keyFinding,
      etiology,
      ...causes,
      ...triggers,
      ...consequences,
    ]).map((v) => v.toLowerCase()),
  );

  const extras = rawLines.filter((line) => !consumed.has(line.toLowerCase()));
  const normalizedBack = composeNormalizedBack({
    primaryAnswer,
    murmur,
    keyFinding,
    etiology,
    causes,
    triggers,
    consequences,
    extras,
  }) || rawBack;

  const structured = structureBackText(normalizedBack);
  const ungrouped = structured.ungrouped;
  const highYield = clean(
    input.high_yield ||
      [
        structured.primaryAnswer?.value,
        structured.groups.find((g) => /^key finding$/i.test(g.label))?.lines[0],
        ungrouped[0],
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(" • "),
  ) || null;

  const clinicalPearl = clean(
    input.clinical_pearl ||
      structured.groups.find((g) => /^consequence/i.test(g.label))?.lines[0] ||
      structured.groups.find((g) => /^key point$/i.test(g.label))?.lines[0] ||
      "",
  ) || null;

  return {
    front,
    back: normalizedBack,
    section: clean(input.section) || null,
    tags: upsertFlashcardTitleTag(Array.isArray(input.tags) ? input.tags : [], title || null),
    high_yield: highYield,
    clinical_pearl: clinicalPearl,
    memory_tip: clean(input.memory_tip) || null,
    references: uniq(input.references ?? []),
    difficulty: normalizeDifficulty(input.difficulty),
    source: clean(input.source) || "import",
    image_url: clean(input.image_url) || null,
    title: title || null,
  };
}

function mapCardObject(raw: Record<string, unknown>): ImportedFlashcardInput | null {
  const front = clean(String(raw.front ?? raw.question ?? ""));
  const back = clean(String(raw.back ?? raw.answer ?? raw.back_summary ?? raw.primary_answer ?? ""));
  const title = clean(String(raw.title ?? raw.name ?? raw.topic ?? ""));
  if (!front || !back) return null;
  return {
    front,
    back,
    section: clean(String(raw.part ?? raw.section ?? raw.category_section ?? "")) || null,
    title: title || null,
    tags: asList(raw.tags),
    high_yield: clean(String(raw.high_yield ?? "")) || null,
    clinical_pearl: clean(String(raw.clinical_pearl ?? "")) || null,
    memory_tip: clean(String(raw.memory_tip ?? "")) || null,
    references: asList(raw.references),
    difficulty: (raw.difficulty as string | number | null | undefined) ?? null,
    source: clean(String(raw.source ?? raw.deck ?? "import")) || "import",
    image_url: clean(String(raw.image_url ?? "")) || null,
    primary_answer: clean(String(raw.primary_answer ?? raw.answer_core ?? "")) || null,
    murmur: clean(String(raw.murmur ?? "")) || null,
    key_finding: clean(String(raw.key_finding ?? raw.keyfinding ?? "")) || null,
    etiology: clean(String(raw.etiology ?? "")) || null,
    causes: asList(raw.causes),
    triggers: asList(raw.triggers),
    consequences: asList(raw.consequences),
  };
}

function parseJsonCards(text: string) {
  if (!looksLikeJsonCards(text)) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { cards?: unknown[] }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : [];
    return list
      .map((item) => (item && typeof item === "object" ? mapCardObject(item as Record<string, unknown>) : null))
      .filter((item): item is ImportedFlashcardInput => Boolean(item));
  } catch {
    return [];
  }
}

function parseStructuredTextCards(text: string) {
  return parseStructuredFlashcards(text).map((card) => ({
    front: card.front,
    back: card.back,
    section: card.section,
    title: card.title,
    tags: [],
    source: "structured-import",
  }));
}

function parseDeckMarkdown(text: string) {
  if (!looksLikeDeckMarkdown(text)) return [] as ImportedFlashcardInput[];
  const blocks = text.split(/\n(?=###\s+)/g);
  const results: ImportedFlashcardInput[] = [];
  for (const block of blocks) {
    const titleMatch = block.match(/^###\s+(.+)$/m);
    const frontMatch = block.match(/\*\*Front:\*\*\s*([\s\S]*?)(?:\n\n|\n\*\*Back:\*\*)/i);
    const backMatch = block.match(/\*\*Back:\*\*\s*([\s\S]*?)(?:\n\n_Tags:_|\n---|$)/i);
    if (!frontMatch || !backMatch) continue;
    const titleRaw = clean(titleMatch?.[1] ?? "").replace(/^CARD-\d+\s*[·\-]\s*/i, "");
    const front = clean(frontMatch[1]);
    const back = clean(
      backMatch[1]
        .replace(/\s{2,}\n/g, "\n")
        .replace(/^\s*[•►]\s*/gm, "• "),
    );
    const tagMatch = block.match(/_Tags:_\s*`([^`]+)`/i);
    const tags = tagMatch ? uniq(tagMatch[1].split(/\s*,\s*/g)) : [];
    if (front && back) {
      results.push({
        front,
        back,
        title: titleRaw || null,
        tags,
        source: "markdown-deck",
      });
    }
  }
  return results;
}

function parseDelimited(text: string, delimiter: "," | "\t") {
  const rows = parseCsvLike(text, delimiter);
  return rows
    .map((row) => mapCardObject(row))
    .filter((item): item is ImportedFlashcardInput => Boolean(item));
}

export function parseImportedFlashcards(rawText: string, fileName = "") {
  const text = clean(rawText);
  if (!text) return [] as PreparedImportedFlashcard[];
  const lower = fileName.toLowerCase();

  const direct =
    (lower.endsWith(".json") ? parseJsonCards(text) : []) || [];
  const candidates: ImportedFlashcardInput[] = direct.length
    ? direct
    : lower.endsWith(".tsv")
      ? parseDelimited(rawText, "\t")
      : lower.endsWith(".csv")
        ? parseDelimited(rawText, ",")
        : parseStructuredTextCards(rawText).length
          ? parseStructuredTextCards(rawText)
          : parseDeckMarkdown(rawText).length
            ? parseDeckMarkdown(rawText)
            : looksLikeJsonCards(rawText)
              ? parseJsonCards(rawText)
              : [];

  const seen = new Set<string>();
  const cards: PreparedImportedFlashcard[] = [];
  for (const item of candidates) {
    const enriched = enrichFromBack(item);
    const key = `${enriched.title ?? ""}__${enriched.front}__${enriched.back}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(enriched);
  }
  return cards;
}
