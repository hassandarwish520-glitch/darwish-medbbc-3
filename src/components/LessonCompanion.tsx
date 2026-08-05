"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, NotebookPen, Save } from "lucide-react";
import AITutor from "@/components/AITutor";

type Props = {
  lessonId: string;
  lessonTitle: string;
  lessonContext?: string;
};

type NoteRow = {
  id: string;
  body: string;
  updated_at?: string | null;
};

export default function LessonCompanion({ lessonId, lessonTitle, lessonContext = "" }: Props) {
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/notes?lesson_id=${encodeURIComponent(lessonId)}`);
        const payload = await r.json();
        if (!alive) return;
        const note = payload?.note as NoteRow | null;
        setBody(note?.body ?? "");
        setSavedAt(note?.updated_at ?? null);
      } catch {
        if (alive) setStatus("Unable to load the current notes.");
      } finally {
        if (alive) setLoaded(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const noteHint = useMemo(() => {
    if (!savedAt) return "Not saved yet";
    return `Last saved: ${new Date(savedAt).toLocaleString()}`;
  }, [savedAt]);

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, body }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload?.error || "Failed to save notes");
      setSavedAt(payload?.note?.updated_at ?? new Date().toISOString());
      setStatus(body.trim() ? "Notes saved and linked to AI Tutor." : "Empty notes were removed.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr,1.25fr]">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <NotebookPen className="h-5 w-5 text-brand" /> Lesson Companion
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Write quick study notes here, then save them so AI Tutor can use them for explanation and review.
            </p>
          </div>
          <button className="btn-primary text-xs" onClick={() => void save()} disabled={busy || !loaded}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>

        <textarea
          className="input mt-4 min-h-[280px]"
          placeholder="Write your summary, key points, review questions, or any notes you want AI Tutor to use..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{noteHint}</span>
          {status && (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> {status}
            </span>
          )}
        </div>
      </div>

      <AITutor
        variant="inline"
        title={`${lessonTitle} • AI Tutor`}
        lessonTitle={lessonTitle}
        lessonContext={lessonContext}
        companionNotes={body}
      />
    </div>
  );
}
