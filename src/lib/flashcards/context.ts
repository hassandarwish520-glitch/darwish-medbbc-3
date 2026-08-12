/**
 * Helpers that turn the existing flashcard fields into a self-contained
 * question + breadcrumb so the FRONT is never ambiguous on its own.
 *
 * Rule: never invent new medical facts. We may only rephrase the EXISTING
 * prompt fragment into a complete question using the already-known or
 * inferred topic title and the labels detected from the card BACK.
 */

import { structureBackText } from "@/lib/flashcards/structure";

export type BreadcrumbInput = {
  subject?: string | null;
  area?: string | null;
  title?: string | null;
};

function cleanPrompt(value: string) {
  return (value ?? "")
    .replace(/^\s*[•\-–—*]+\s*/, "")
    .replace(/^\s*(?:q|question|front)\s*[:\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(title: string) {
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function titleAlreadyPresent(prompt: string, title: string) {
  const p = prompt.toLowerCase();
  const t = title.toLowerCase();
  if (!title) return false;
  if (p.includes(t) || t.includes(p)) return true;
  const longTokens = titleTokens(title).filter((token) => token.length >= 5);
  if (longTokens.some((token) => p.includes(token))) return true;
  const acronym = title
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toLowerCase();
  if (acronym.length >= 2 && p.includes(acronym)) return true;
  return false;
}

function sentenceCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ensureQuestion(value: string) {
  const trimmed = value.trim().replace(/[?.!]+$/g, "");
  return `${trimmed}?`;
}

function hasLabel(rawBack: string, labelPrefix: string) {
  const structured = structureBackText(rawBack);
  return structured.groups.some((group) => group.label.toLowerCase().startsWith(labelPrefix.toLowerCase()));
}

function containsAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

/**
 * Best-effort title inference for already-imported legacy cardiology cards
 * that lost their TITLE metadata during older extraction runs.
 */
export function inferTopicTitleFromCard(card: {
  front?: string | null;
  back?: string | null;
  section?: string | null;
  tags?: string[] | null;
}): string | null {
  const front = cleanPrompt(card.front ?? "");
  const back = (card.back ?? "").replace(/\s+/g, " ").trim();
  const haystack = `${front} \n ${back} \n ${(card.section ?? "")} \n ${String((card.tags ?? []).join(" "))}`.toLowerCase();

  const rules: Array<{ title: string; when: (text: string) => boolean }> = [
    {
      title: "Mitral Stenosis",
      when: (text) => containsAny(text, [
        "opening snap",
        "low-pitched diastolic rumble",
        "left atrial enlargement",
        "left atrial thrombus",
        "rheumatic heart disease",
      ]),
    },
    {
      title: "Aortic Stenosis",
      when: (text) => containsAny(text, [
        "radiates to carotids",
        "crescendo-decrescendo systolic murmur",
        "calcific degeneration",
        "syncope, angina, dyspnea",
        "pulsus parvus et tardus",
        "bicuspid aortic valve",
      ]),
    },
    {
      title: "Mitral Regurgitation",
      when: (text) => containsAny(text, [
        "radiates to axilla",
        "holosystolic murmur",
        "mitral valve prolapse",
        "papillary muscle dysfunction",
        "left atrial dilation",
        "left ventricular dilation",
      ]),
    },
    {
      title: "Stable Angina",
      when: (text) => containsAny(text, [
        "exertional chest pain relieved by rest",
        "fixed atherosclerotic coronary narrowing",
        "troponin normal",
        "sublingual nitroglycerin",
      ]),
    },
    {
      title: "Unstable Angina",
      when: (text) => containsAny(text, [
        "plaque rupture",
        "partially occlusive thrombus",
        "new-onset, worsening, or rest angina",
        "troponin remains normal",
      ]),
    },
    {
      title: "NSTEMI",
      when: (text) => containsAny(text, [
        "troponin elevated",
        "subendocardial infarction",
        "no persistent st elevation",
      ]) || text.includes("nstemi"),
    },
    {
      title: "STEMI",
      when: (text) => containsAny(text, [
        "persistent st elevation",
        "transmural infarction",
        "complete coronary occlusion",
        "q waves may develop",
      ]) || text.includes("stemi"),
    },
    {
      title: "Post-MI Complications",
      when: (text) => containsAny(text, [
        "papillary muscle rupture",
        "ventricular septal rupture",
        "free wall rupture",
        "dressler",
        "post-mi",
      ]),
    },
    {
      title: "Infective Endocarditis",
      when: (text) => containsAny(text, [
        "janeway",
        "osler",
        "splinter hemorrhages",
        "s. aureus",
        "viridans streptococci",
        "hacek",
        "endocarditis",
      ]),
    },
  ];

  for (const rule of rules) {
    if (rule.when(haystack)) return rule.title;
  }

  return null;
}

function convertFragmentToQuestion(fragment: string, title: string, rawBack: string) {
  const f = fragment.toLowerCase().replace(/[?.!]+$/g, "").trim();
  const murmurContext = hasLabel(rawBack, "murmur") || /murmur/i.test(fragment);

  const exactMap: Array<{ pattern: RegExp; make: () => string }> = [
    { pattern: /^best heard$/, make: () => murmurContext ? `Where is the murmur best heard in ${title}` : `Where is it best heard in ${title}` },
    { pattern: /^(characteristic )?murmur$/, make: () => `What is the characteristic murmur of ${title}` },
    { pattern: /^progression$/, make: () => `How does ${title} typically progress` },
    { pattern: /^classic cause$/, make: () => `What is the classic cause of ${title}` },
    { pattern: /^cause$/, make: () => `What causes ${title}` },
    { pattern: /^etiology$/, make: () => `What is the etiology of ${title}` },
    { pattern: /^triad$/, make: () => `What is the classic triad of ${title}` },
    { pattern: /^triggers?$/, make: () => `What triggers ${title}` },
    { pattern: /^relief$/, make: () => `What relieves ${title}` },
    { pattern: /^management$/, make: () => `How is ${title} managed` },
    { pattern: /^treatment$/, make: () => `How is ${title} treated` },
    { pattern: /^troponin$/, make: () => `What is the troponin level in ${title}` },
    { pattern: /^ecg at rest$/, make: () => `What is the ECG at rest in ${title}` },
    { pattern: /^ecg during (?:an? )?attack$/, make: () => `What is the ECG during an attack of ${title}` },
    { pattern: /^first-line acute relief$/, make: () => `What is the first-line acute relief for ${title}` },
    { pattern: /^extra heart sound$/, make: () => `What is the extra heart sound in ${title}` },
    { pattern: /^key finding$/, make: () => `What is the key finding in ${title}` },
    { pattern: /^consequences$/, make: () => `What are the main consequences of ${title}` },
    { pattern: /^clinical features$/, make: () => `What are the clinical features of ${title}` },
  ];

  for (const entry of exactMap) {
    if (entry.pattern.test(f)) return ensureQuestion(entry.make());
  }

  const alreadyQuestionLike = /^(what|which|where|when|why|how|who|can|does|do|is|are)\b/i.test(fragment.trim());
  if (alreadyQuestionLike) {
    if (titleAlreadyPresent(fragment, title)) return ensureQuestion(sentenceCase(fragment));
    const normalized = ensureQuestion(sentenceCase(fragment));
    if (/\bit\b/i.test(normalized) || /\bthis\b/i.test(normalized)) {
      return normalized.replace(/\bit\b/i, title).replace(/\bthis\b/i, title);
    }
    return normalized.replace(/\?$/, ` in ${title}?`);
  }

  const wordCount = f.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 4) {
    if (murmurContext && f === "best heard") {
      return ensureQuestion(`Where is the murmur best heard in ${title}`);
    }
    return ensureQuestion(`What is the ${f} in ${title}`);
  }

  return ensureQuestion(`${title} — ${sentenceCase(fragment)}`);
}

export function makeSelfContainedFront(opts: {
  front: string;
  title?: string | null;
  rawBack?: string | null;
}): string {
  const prompt = cleanPrompt(opts.front);
  if (!prompt) return "";

  const title = (opts.title ?? "").trim();
  if (!title) return ensureQuestion(sentenceCase(prompt));
  if (titleAlreadyPresent(prompt, title)) return ensureQuestion(sentenceCase(prompt));

  const looksShortAndFragmentary = prompt.split(/\s+/).filter(Boolean).length <= 5 || !/[?]/.test(prompt);
  if (looksShortAndFragmentary) {
    return convertFragmentToQuestion(prompt, title, opts.rawBack ?? "");
  }

  return ensureQuestion(`${sentenceCase(prompt)} in ${title}`);
}

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

export function buildCardSearchText(card: {
  front: string;
  back: string;
  section?: string | null;
  cardTitle?: string | null;
  tags?: string[] | null;
  displayFront?: string | null;
  breadcrumbParts?: string[] | null;
}) {
  return [
    card.front,
    card.back,
    card.section ?? "",
    card.cardTitle ?? "",
    card.displayFront ?? "",
    ...(card.tags ?? []),
    ...(card.breadcrumbParts ?? []),
  ]
    .join(" \n ")
    .toLowerCase();
}
