"use client";

import { Star } from "lucide-react";
import { useStudy } from "@/contexts/StudyContext";

/**
 * Compact bookmark button — used inline next to a question or at the top
 * of a lesson page. One tap toggles, no full card list underneath.
 */
export default function InlineBookmark({ lessonId, hint = false }: { lessonId: string; hint?: boolean }) {
  const { state, dispatch } = useStudy();
  const saved = Boolean(state.bookmarks[lessonId]);

  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "TOGGLE_BOOKMARK", lessonId })}
      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition ${
        saved
          ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
          : "border-ink-700 bg-ink-900/60 text-slate-300 hover:border-amber-400/30 hover:text-amber-300"
      }`}
      aria-pressed={saved}
      title={saved ? "Bookmarked" : "Bookmark this"}
    >
      <Star className={`h-3.5 w-3.5 ${saved ? "fill-amber-400 text-amber-400" : ""}`} />
      <span>{saved ? "Saved" : hint ? "Bookmark" : ""}</span>
    </button>
  );
}
