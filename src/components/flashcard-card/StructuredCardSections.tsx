"use client";
/**
 * Sub-views used inside FlashcardDeckRunner to render the structured BACK
 * without inventing content: takes the groups/ungrouped lines that
 * structureBackText returned and draws them with type‑level hierarchy
 * (label = uppercase tracked text, value = heavier & larger body).
 */
import type { SectionGroup } from "@/lib/flashcards/structure";

export function SectionGroupsView({ groups }: { groups: SectionGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {groups.map((group, idx) => (
        <div key={`${group.label}-${idx}`} className="rounded-xl bg-white/[0.03] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300/80">
            {group.label}
          </div>
          <ul className="mt-1.5 space-y-1 text-[15px] font-medium leading-snug text-white">
            {group.lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="select-none text-blue-300/70">›</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function UngroupedBullets({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="space-y-1 text-[15px] font-medium leading-snug text-white">
      {lines.map((line, idx) => (
        <li key={idx} className="flex gap-2">
          <span aria-hidden className="select-none text-blue-300/70">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
