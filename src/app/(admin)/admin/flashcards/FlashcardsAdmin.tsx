"use client";
import { useState } from "react";
import { Plus, Sparkles, Trash2, Layers } from "lucide-react";

type F = { id: string; front: string; back: string; tags: string[]; ai_generated: boolean };
type LessonOption = { id: string; title: string };
type AddModalProps = { onClose: () => void; onCreated: (card: F) => void; lessons: LessonOption[] };
type AIModalProps = { onClose: () => void; lessons: LessonOption[] };

export default function FlashcardsAdmin({ initial, lessons }: { initial: F[]; lessons: LessonOption[] }) {
  const [rows, setRows] = useState<F[]>(initial);
  const [open, setOpen] = useState<null | "add" | "ai">(null);

  async function remove(id: string) {
    if (!confirm("Delete card?")) return;
    await fetch("/api/admin/flashcards?id=" + id, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="flex gap-2 mt-4">
        <button className="btn-ghost" onClick={() => setOpen("ai")}><Sparkles className="h-4 w-4" /> Generate with AI</button>
        <button className="btn-primary" onClick={() => setOpen("add")}><Plus className="h-4 w-4" /> Add Card</button>
      </div>

      {!rows.length ? (
        <div className="card p-10 mt-4 text-center">
          <Layers className="h-8 w-8 mx-auto text-slate-500" />
          <div className="mt-2">No flashcards yet</div>
          <div className="text-sm text-slate-500">Add cards manually or generate a set from your study material using AI.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {rows.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="text-sm font-medium">{c.front}</div>
              <div className="text-xs text-slate-400 mt-2">{c.back}</div>
              <div className="mt-2 flex items-center gap-2">
                {c.ai_generated && <span className="text-xs text-brand">AI</span>}
                <button className="ml-auto btn-ghost text-xs" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open === "add" && <AddModal onClose={() => setOpen(null)} onCreated={(c: F) => { setRows((r) => [c, ...r]); setOpen(null); }} lessons={lessons} />}
      {open === "ai" && <AIModal onClose={() => setOpen(null)} lessons={lessons} />}
    </>
  );
}

function AddModal({ onClose, onCreated, lessons }: AddModalProps) {
  const [f, setF] = useState({ lesson_id: "", front: "", back: "", tags: "" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/admin/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson_id: f.lesson_id || null,
        front: f.front,
        back: f.back,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    if (r.ok) {
      const { card } = await r.json();
      onCreated(card as F);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-md space-y-2">
        <h3 className="text-lg font-semibold">New Flashcard</h3>
        <select className="input" value={f.lesson_id} onChange={(e) => setF({ ...f, lesson_id: e.target.value })}>
          <option value="">— No lesson —</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <textarea className="input h-20" placeholder="Front" value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} />
        <textarea className="input h-24" placeholder="Back" value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} />
        <input className="input" placeholder="Tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AIModal({ onClose, lessons }: AIModalProps) {
  const [lesson_id, setL] = useState(lessons[0]?.id ?? "");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const r = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id, mode: "flashcards", count }),
    });
    setBusy(false);
    const j = await r.json();
    if (j.inserted) location.reload();
    else alert(j.error || "AI error");
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-md space-y-2">
        <h3 className="text-lg font-semibold">AI Generate Flashcards</h3>
        <select className="input" value={lesson_id} onChange={(e) => setL(e.target.value)}>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <input className="input" type="number" value={count} onChange={(e) => setCount(+e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={busy || !lesson_id} onClick={run}>Generate</button>
        </div>
      </div>
    </div>
  );
}
