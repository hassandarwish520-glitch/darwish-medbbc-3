"use client";

import { useEffect, useState } from "react";
import { PencilLine, Save, Trash2 } from "lucide-react";
import { useStudy } from "@/contexts/StudyContext";

/**
 * Inline notes drawer that sits next to the video (split-view).
 * Auto-saves the draft on blur; full save goes via the existing
 * /api/notes endpoint (kept as-is to avoid schema work this turn).
 *
 * No page reload on save — the network call is fire-and-forget and
 * the state remains in context, so switching to Q-Bank or Bookmark
 * does not refetch the lesson.
 */
export default function SplitNotes({ lessonId, lessonTitle, currentTime }: { lessonId: string; lessonTitle: string; currentTime: number }) {
  const { state, dispatch } = useStudy();
  const [body, setBody] = useState<string>(state.notesDraft[lessonId] ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setBody(state.notesDraft[lessonId] ?? "");
  }, [lessonId, state.notesDraft]);

  async function save() {
    if (!body.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          title: lessonTitle,
          body: body.trim(),
          meta: { timestamp: Math.floor(currentTime) },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatch({ type: "SET_NOTE_DRAFT", lessonId, body: "" });
      setStatus("Note saved");
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus("Could not save — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[180px] flex-col rounded-2xl border border-ink-800 bg-ink-900/80">
      <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400">
        <PencilLine className="h-3.5 w-3.5 text-brand" />
        <span>Notes</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </span>
      </div>
      <textarea
        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-200 outline-none"
        placeholder="Write here — auto-saves when you leave the field."
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          dispatch({ type: "SET_NOTE_DRAFT", lessonId, body: e.target.value });
        }}
        onBlur={() => {
          if (body.trim()) void save();
        }}
      />
      <div className="flex items-center justify-between border-t border-ink-800 px-3 py-2">
        {status ? <span className="text-[11px] text-emerald-300">{status}</span> : <span className="text-[11px] text-slate-500">Saved on blur</span>}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setBody("");
              dispatch({ type: "SET_NOTE_DRAFT", lessonId, body: "" });
            }}
            className="rounded-md p-1 text-slate-400 transition hover:text-red-300"
            aria-label="Clear draft"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !body.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white transition disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
