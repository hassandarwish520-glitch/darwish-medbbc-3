/**
 * Structuring helper for flashcard BACK content.
 *
 * The raw BACK text in this app is almost always bullet style, e.g. for
 * Mitral Stenosis:
 *   • Murmur: low-pitched diastolic rumble
 *   • Extra heart sound: opening snap
 *   • Causes left atrial enlargement …
 *
 * This helper splits the back into a tree of "sections" and a primary
 * anchor line so the renderer can:
 *   1. Present a dominant answer ("Low-pitched diastolic rumble").
 *   2. Group details inside named sections (Murmur, Etiology, Consequence …).
 *   3. Fall back to plain bullets when no label matches — without dropping
 *      a single word.
 */
export type SectionGroup = {
  label: string;
  lines: string[];
};

export type PrimaryAnswer = {
  label: string;
  value: string;
};

export type StructuredBack = {
  primaryAnswer: PrimaryAnswer | null;
  groups: SectionGroup[];
  ungrouped: string[];
};

const KNOWN_LABELS: RegExp[] = [
  /^primary\s+answer\b/i,
  /^answer\b/i,
  /^high.?yield\b/i,
  /^murmur\b/i,
  /^extra\s+heart\s+sound\b/i,
  /^key\s+finding\b/i,
  /^key\s+feature\b/i,
  /^classic\s+finding\b/i,
  /^auscultation\b/i,
  /^physical\s+exam\b/i,
  /^risk\s+factor/i,
  /^cause\b/i,
  /^causes\b/i,
  /^etiology\b/i,
  /^aetiology\b/i,
  /^pathophysiology\b/i,
  /^mechanism\b/i,
  /^presentation\b/i,
  /^clinical\s+presentation\b/i,
  /^symptoms?\b/i,
  /^signs?\b/i,
  /^features?\b/i,
  /^clinical\s+features?\b/i,
  /^diagnosis\b/i,
  /^investigations?\b/i,
  /^workup\b/i,
  /^labs?\b/i,
  /^lab\s+findings?\b/i,
  /^imaging\b/i,
  /^ecg\b/i,
  /^management\b/i,
  /^treatment\b/i,
  /^therapy\b/i,
  /^first.?line\b/i,
  /^drug\b/i,
  /^drugs\b/i,
  /^dose\b/i,
  /^dosing\b/i,
  /^complication\b/i,
  /^complications\b/i,
  /^prognosis\b/i,
  /^consequence\b/i,
  /^consequences\b/i,
  /^pattern\b/i,
  /^distinction\b/i,
  /^note\b/i,
  /^key\s+point\b/i,
  /^important\b/i,
];

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripBullet(line: string) {
  return clean(line.replace(/^[•\-\*•◦▪►▸›»\s]+/, ""));
}

function splitLabel(line: string): { label: string; value: string } | null {
  const text = stripBullet(line);
  if (!text) return null;
  const m = text.match(/^([A-Za-z][A-Za-z\s\/\-]{1,40})[:\-–]\s*(.+)$/);
  if (!m) return null;
  return { label: clean(m[1]), value: clean(m[2]) };
}

function isKnownLabel(label: string) {
  return KNOWN_LABELS.some((rx) => rx.test(label));
}

function derivePrimaryAnswer(groups: SectionGroup[], fallbackLines: string[]): PrimaryAnswer | null {
  const preferred = groups.find((group) => /^primary\s+answer$/i.test(group.label) || /^answer$/i.test(group.label));
  if (preferred?.lines?.[0] && preferred.lines[0].length >= 4 && preferred.lines[0].length <= 110) {
    return { label: preferred.label, value: preferred.lines[0] };
  }
  for (const group of groups) {
    if (!group.label || !group.lines.length) continue;
    const first = group.lines[0];
    if (first.length >= 4 && first.length <= 110) {
      return { label: group.label, value: first };
    }
  }
  if (!groups.length && fallbackLines.length) {
    const first = stripBullet(fallbackLines[0]);
    if (first.length >= 8 && first.length <= 110) {
      return { label: "Primary", value: first };
    }
  }
  return null;
}

export function structureBackText(raw: string): StructuredBack {
  const groups: SectionGroup[] = [];
  const ungrouped: string[] = [];

  (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => {
      const labeled = splitLabel(line);
      if (labeled && isKnownLabel(labeled.label)) {
        const existing = groups.find((g) => g.label.toLowerCase() === labeled.label.toLowerCase());
        if (existing) {
          existing.lines.push(labeled.value);
        } else {
          groups.push({ label: labeled.label, lines: [labeled.value] });
        }
        return;
      }
      ungrouped.push(stripBullet(line));
    });

  const primaryAnswer = derivePrimaryAnswer(groups, ungrouped);

  // When the primary anchor came from ungrouped fallback, drop its source
  // so the same line is not rendered twice (groups + primary).
  if (primaryAnswer?.label === "Primary") {
    ungrouped.shift();
  }

  return { primaryAnswer, groups, ungrouped };
}
