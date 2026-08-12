const PART_LINE = /^\s*(PART(?:\s+\d+)?(?:\s*[-—–:]\s*.+)?|PART\s*:\s*.+)\s*$/i;
const FIELD_LINE = /^\s*(TITLE|FRONT|BACK)\s*(?::|[-—–])?\s*(.*)$/i;
export const FLASHCARD_TITLE_TAG_PREFIX = "title:";

export type StructuredFlashcard = {
  title: string;
  front: string;
  back: string;
  section: string | null;
};

function cleanLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSection(raw: string) {
  const line = cleanLine(raw);
  if (!line) return null;
  if (/^PART\s*:/i.test(line)) return line.replace(/^PART\s*:/i, "PART ").trim();
  return line;
}

function normalizeMultilineValue(lines: string[]) {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractFlashcardTitle(tags?: string[] | null) {
  const raw = (tags ?? []).find((tag) => typeof tag === "string" && tag.toLowerCase().startsWith(FLASHCARD_TITLE_TAG_PREFIX));
  if (!raw) return null;
  const title = raw.slice(FLASHCARD_TITLE_TAG_PREFIX.length).trim();
  return title || null;
}

export function upsertFlashcardTitleTag(tags: string[] = [], title?: string | null) {
  const next = tags.filter((tag) => !tag.toLowerCase().startsWith(FLASHCARD_TITLE_TAG_PREFIX));
  if (title?.trim()) next.unshift(`${FLASHCARD_TITLE_TAG_PREFIX}${title.trim()}`);
  return Array.from(new Set(next));
}

export function looksLikeStructuredFlashcardText(raw: string) {
  if (!raw || !raw.trim()) return false;
  const titleCount = (raw.match(/^\s*TITLE\s*(?::|[-—–])/gim) ?? []).length;
  const frontCount = (raw.match(/^\s*FRONT\s*(?::|[-—–])/gim) ?? []).length;
  const backCount = (raw.match(/^\s*BACK\s*(?::|[-—–])/gim) ?? []).length;
  return titleCount > 0 && frontCount > 0 && backCount > 0;
}

export function parseStructuredFlashcards(raw: string): StructuredFlashcard[] {
  if (!looksLikeStructuredFlashcardText(raw)) return [];

  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, " "));

  const cards: StructuredFlashcard[] = [];
  let currentSection: string | null = null;
  let currentField: "title" | "front" | "back" | null = null;
  let titleLines: string[] = [];
  let frontLines: string[] = [];
  let backLines: string[] = [];

  const pushCard = () => {
    const title = normalizeMultilineValue(titleLines);
    const front = normalizeMultilineValue(frontLines);
    const back = normalizeMultilineValue(backLines);
    if (!title || !front || !back) return;
    cards.push({ title, front, back, section: currentSection });
  };

  const resetCard = () => {
    currentField = null;
    titleLines = [];
    frontLines = [];
    backLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const compact = cleanLine(line);
    if (!compact) {
      if (currentField === "front") frontLines.push("");
      if (currentField === "back") backLines.push("");
      continue;
    }

    if (PART_LINE.test(compact)) {
      if (titleLines.length || frontLines.length || backLines.length) {
        pushCard();
        resetCard();
      }
      currentSection = normalizeSection(compact);
      continue;
    }

    const fieldMatch = compact.match(FIELD_LINE);
    if (fieldMatch) {
      const field = fieldMatch[1].toUpperCase() as "TITLE" | "FRONT" | "BACK";
      const inlineValue = fieldMatch[2]?.trim() ?? "";

      if (field === "TITLE") {
        if (titleLines.length || frontLines.length || backLines.length) {
          pushCard();
          resetCard();
        }
        currentField = "title";
        if (inlineValue) titleLines.push(inlineValue);
        continue;
      }

      currentField = field.toLowerCase() as "front" | "back";
      if (inlineValue) {
        if (currentField === "front") frontLines.push(inlineValue);
        if (currentField === "back") backLines.push(inlineValue);
      }
      continue;
    }

    if (currentField === "title") titleLines.push(compact);
    else if (currentField === "front") frontLines.push(line.trim());
    else if (currentField === "back") backLines.push(line.trim());
  }

  if (titleLines.length || frontLines.length || backLines.length) pushCard();

  return cards;
}
