/**
 * Helpers that turn the existing flashcard fields into a self-contained
 * question + 3-level breadcrumb so the FRONT is unambiguous on its own.
 *
 * The system is "automatic" in the sense that we NEVER invent clinical
 * content — we only rearrange the field the user/teacher already wrote
 * (title = disease, section = subject area, front = raw prompt) into a
 * topic-prefixed form and surface the breadcrumb chain.
 */

export type BreadcrumbInput = {
  /** Subject, e.g. "Cardiology" — usually the first tag on the card. */
  subject?: string | null;
  /** Section the card belongs to — usually `card.section` from PART lines. */
  area?: string | null;
  /** Topic/disease name, e.g. "Mitral Stenosis" — `card.cardTitle`. */
  title?: string | null;
};

/**
 * Build a self-contained prompt for the FRONT side.
 *
 * If the prompt already mentions the topic (long tokens ≥5 chars appear
 * in both), leave it untouched. Otherwise prefix with the title so the
 * student never sees an ambiguous "Best heard?" with no clinical anchor.
 *
 * Examples:
 *   { front: "Best heard",          title: "Mitral Stenosis" }
 *     → "Mitral Stenosis — Best heard?"
 *   { front: "Classic cause?"      title: "Mitral Stenosis" }
 *     → "Mitral Stenosis — Classic cause?"
 *   { front: "Workup of AS?"       title: "Aortic Stenosis" }
 *     → "Workup of AS?"  (already contains "AS" via 3-char match — fine)
 *   { front: "What causes it?"     title: "Mitral Stenosis" }
 *     → "Mitral Stenosis — What causes it?"
 */
export function makeSelfContainedFront(opts: {
  front: string;
  title?: string | null;
}): string {
  const rawFront = (opts.front ?? "").trim();
  if (!rawFront) return "";

  // Strip "Q:" / "Question:" / "Front:" artifacts that may exist.
  const cleaned = rawFront.replace(/^\s*(?:q|question|front)\s*[:\-]\s*/i, "").trim();
  const title = (opts.title ?? "").trim();
  if (!title) return cleaned;

  const tLow = title.toLowerCase();
  const fLow = cleaned.toLowerCase();

  // Whole-title inclusion either direction.
  if (tLow && (fLow.includes(tLow) || tLow.includes(fLow))) return cleaned;

  // Any individual long token (≥5 letters) appears in the prompt?
  const longTokens = tLow.split(/\s+/).filter((w) => w.length >= 5);
  if (longTokens.some((tok) => fLow.includes(tok))) return cleaned;

  // Acronym-style match (≥3 chars) like "AS", "MR".
  const shortAcronyms = title
    .split(/\s+/)
    .filter((w) => /^[A-Z]{2,}$/.test(w) && w.length >= 3)
    .map((w) => w.toLowerCase());
  if (shortAcronyms.some((tok) => fLow.includes(tok))) return cleaned;

  // Otherwise prefix the topic.
  let prompt = cleaned;
  if (!/[.?!]$/.test(prompt)) {
    prompt = prompt.endsWith(".") ? prompt : `${prompt}?`;
  }
  if (/^[a-z]/.test(prompt)) {
    prompt = prompt.charAt(0).toUpperCase() + prompt.slice(1);
  }
  return `${title} — ${prompt}`;
}

/**
 * Build a 1–3 crumb breadcrumb chain.
 *
 * Strips "PART N — " prefix from `area` and uppercases every level so the
 * chain reads as the user requested:
 *   CARDIOLOGY › VALVULAR HEART DISEASE › MITRAL STENOSIS
 *
 * Falls back gracefully when fields are missing: with only `area`
 *   VALVULAR HEART DISEASE › MITRAL STENOSIS
 */
export function buildBreadcrumb(opts: BreadcrumbInput): string[] {
  const cleaned = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/[:\-—–]+$/u, "")
      .trim()
      .toUpperCase();

  const out: string[] = [];
  const subject = cleaned(opts.subject);
  const area = cleaned(opts.area).replace(/^PART(?:\s+\d+)?\s*[-—–:]\s*/iu, "").trim();
  const title = cleaned(opts.title);

  for (const crumb of [subject, area, title]) {
    if (crumb && out[out.length - 1] !== crumb) out.push(crumb);
  }
  return out;
}

/**
 * Helper that derives breadcrumb from the card record directly. The card's
 * tags typically already include the subject (first tag) and the
 * title-prefixed mark `title:NAME`. Use this from the runner so a missing
 * subject just drops the first crumb.
 */
export function deriveBreadcrumbFromCard(card: {
  section?: string | null;
  cardTitle?: string | null;
  tags?: string[] | null;
}): string[] {
  const title = card.cardTitle ?? null;
  let subject: string | null = null;
  for (const tag of card.tags ?? []) {
    if (typeof tag !== "string") continue;
    const low = tag.toLowerCase();
    if (low.startsWith("title:") || low.startsWith("section:") || low.startsWith("high_yield") || low.startsWith("difficulty:")) continue;
    if (tag.trim().length >= 3) {
      subject = tag.trim();
      break;
    }
  }
  return buildBreadcrumb({ subject, area: card.section ?? null, title });
}
