"use client";

import { FileText, Lock, Play } from "lucide-react";
import { classifyRedirect, openExternalIfAllowed } from "@/lib/study/external-redirect";
import { useStudy } from "@/contexts/StudyContext";

export type MaterialProps = {
  lessonId: string;
  label: string;
  url: string;
  mime?: string | null;
  kind?: string | null;
};

/**
 * Compact material card. Deliberately hides the file extension and the
 * raw storage URL — it shows a human label and an action button. The
 * action opens either:
 *   - YouTube / Telegram in the system browser (via the redirect helper),
 *   - or the in-app MaterialViewer via context (which never calls
 *     window.open nor target="_blank").
 *
 * The download icon is GONE by design — the spec forbids it.
 */
export default function MaterialCard({ lessonId, label, url, mime }: MaterialProps) {
  const { dispatch } = useStudy();
  const isImage = (mime ?? "").startsWith("image/");
  const external = classifyRedirect(url);

  function handleOpen() {
    if (external.kind === "youtube" || external.kind === "telegram") {
      openExternalIfAllowed(url);
      return;
    }
    // Marks the material as the active open target; the StudyScreen then
    // mounts the InlineMaterialViewer instead of navigating.
    dispatch({ type: "MARK_MATERIAL_OPENED", lessonId });
    window.dispatchEvent(
      new CustomEvent("study:open-material", { detail: { lessonId, url, mime, label } }),
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900/70 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-300">
        {isImage ? <Play className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">Lecture Material</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">{label}</div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
        <Lock className="h-3 w-3" /> View only
      </span>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-xl bg-brand px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-dark"
      >
        Open
      </button>
    </div>
  );
}
