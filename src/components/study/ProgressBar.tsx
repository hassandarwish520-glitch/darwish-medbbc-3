"use client";

import { useStudy } from "@/contexts/StudyContext";

/**
 * One-line thin progress bar replaced the four-card grid. Reads from the
 * single progress map in context, no extra fetch.
 */
export default function ProgressBar({ label = "Progress" }: { label?: string }) {
  const { state } = useStudy();
  const lessonId = state.session.lessonId;
  const stored = lessonId ? state.progress[lessonId] : null;
  const sessionPct =
    state.session.duration > 0
      ? Math.min(100, Math.round((state.session.currentTime / state.session.duration) * 100))
      : 0;
  const storedPct =
    stored && stored.duration > 0
      ? Math.min(100, Math.round((stored.position / stored.duration) * 100))
      : 0;
  const pct = Math.max(sessionPct, storedPct);

  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
      <span>{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand via-cyan-400 to-fuchsia-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-slate-300">{pct}%</span>
    </div>
  );
}
