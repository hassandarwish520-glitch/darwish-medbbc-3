type JsonMap = Record<string, unknown>;

type LessonLike = {
  kind?: string | null;
  title?: string | null;
  html_body?: string | null;
  meta?: JsonMap | null;
};

type QuestionLike = {
  stem?: string | null;
  explanation?: string | null;
  choices?: Array<{ key?: string; text?: string }> | null;
  tags?: string[] | null;
  image_caption?: string | null;
};

type FlashcardLike = {
  front?: string | null;
  back?: string | null;
  tags?: string[] | null;
};

type NoteLike = {
  body?: string | null;
};

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function decodeEntities(input: string) {
  return input.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITY_MAP[m] ?? m);
}

export function normalizeText(input: string) {
  return decodeEntities(input).replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

export function stripHtml(html: string) {
  return normalizeText(
    html
      // Remove entire <head> block first (CSS, JS, meta tags, title)
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
      // Preserve line breaks from block elements before stripping tags
      .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote|pre|section|article|header|footer)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function metaString(meta: JsonMap | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = meta?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function safeMeta(raw: FormDataEntryValue | string | null | undefined): JsonMap {
  if (!raw) return {};
  const text = typeof raw === "string" ? raw : String(raw);
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonMap) : {};
  } catch {
    return {};
  }
}

export function extractLessonIndexText(lesson: LessonLike, storedHtmlText = "") {
  const meta = (lesson.meta ?? {}) as JsonMap;
  const curated = [
    metaString(meta, "index_text", "extracted_text", "transcript"),
    metaString(meta, "notes", "summary", "description"),
    metaString(meta, "document_name", "document_caption"),
  ]
    .filter(Boolean)
    .join("\n\n");

  const htmlText = lesson.html_body ? stripHtml(lesson.html_body) : "";
  const uploadedHtmlText = storedHtmlText ? stripHtml(storedHtmlText) : "";

  return normalizeText([lesson.title ?? "", curated, htmlText, uploadedHtmlText].filter(Boolean).join("\n\n"));
}

export function extractQuestionIndexText(question: QuestionLike) {
  const choices = Array.isArray(question.choices)
    ? question.choices.map((choice) => `${choice?.key ?? ""}. ${choice?.text ?? ""}`).join(" ")
    : "";
  const tags = Array.isArray(question.tags) ? question.tags.join(", ") : "";
  return normalizeText(
    [question.stem ?? "", choices, question.explanation ?? "", question.image_caption ?? "", tags]
      .filter(Boolean)
      .join("\n\n")
  );
}

export function extractFlashcardIndexText(card: FlashcardLike) {
  const tags = Array.isArray(card.tags) ? card.tags.join(", ") : "";
  return normalizeText([card.front ?? "", card.back ?? "", tags].filter(Boolean).join("\n\n"));
}

export function extractNoteIndexText(note: NoteLike) {
  return normalizeText(note.body ?? "");
}
