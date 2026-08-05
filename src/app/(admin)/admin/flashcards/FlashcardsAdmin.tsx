"use client";
import { useState } from "react";
import { CheckCircle, FileUp, Layers, Loader2, Plus, Trash2 } from "lucide-react";

type F = { id: string; front: string; back: string; tags: string[]; ai_generated: boolean };
type LessonOption = { id: string; title: string };

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

async function createLessonFromFile(file: File, title: string): Promise<string> {
  const lower = file.name.toLowerCase();
  const fd = new FormData();
  fd.set("title", title || file.name.replace(/\.[^.]+$/, ""));

  if (lower.endsWith(".pdf")) {
    fd.set("kind", "pdf");
    fd.set("file", file);
  } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    fd.set("kind", "html-file");
    fd.set("file", file);
  } else {
    // TXT, MD, and anything else → inline HTML lesson
    const raw = await file.text();
    const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;background:#020617;color:#e2e8f0;"><pre style="white-space:pre-wrap;line-height:1.7">${escapeHtml(raw)}</pre></body></html>`;
    fd.set("kind", "html-inline");
    fd.set("html", html);
    fd.set("index_text", raw);
  }

  const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(payload?.error || "Failed to upload file");
  return (payload.lesson as { id: string }).id;
}

export default function FlashcardsAdmin({ initial, lessons }: { initial: F[]; lessons: LessonOption[] }) {
  const [rows, setRows] = useState<F[]>(initial);
  const [open, setOpen] = useState<null | "add" | "extract">(null);

  async function remove(id: string) {
    if (!confirm("Delete this flashcard?")) return;
    const r = await fetch(`/api/admin/flashcards?id=${id}`, { method: "DELETE" });
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      alert(payload?.error || "Failed to delete card");
      return;
    }
    setRows(r => r.filter(x => x.id !== id));
  }

  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-brand">Flashcard Import</div>
          <div className="mt-2 text-lg font-semibold text-white">Extract real flashcards from your source documents</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            Upload any document (PDF, HTML, TXT, Markdown) and the engine will extract high-yield medical flashcards
            directly from the text — preserving original wording, lab values, clinical features, and treatment protocols.
            No AI placeholders. No generic explanations.
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => setOpen("extract")}>
              <FileUp className="h-4 w-4" /> Extract from Document
            </button>
            <button className="btn-primary" onClick={() => setOpen("add")}>
              <Plus className="h-4 w-4" /> Add Card Manually
            </button>
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total flashcards</div>
            <div className="mt-1 text-3xl font-semibold text-white">{rows.length}</div>
          </div>
          <Layers className="h-8 w-8 text-brand" />
        </div>
      </div>

      {!rows.length ? (
        <div className="card p-12 mt-4 text-center">
          <Layers className="h-8 w-8 mx-auto text-slate-500" />
          <div className="mt-3 text-slate-300 font-medium">No flashcards yet</div>
          <div className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Upload a medical document and extract flashcards directly from it, or add cards manually.
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {rows.map(c => (
            <div key={c.id} className="card p-4">
              <div className="text-sm font-medium text-slate-100 leading-6">{c.front}</div>
              <div className="text-xs text-slate-400 mt-3 leading-6 whitespace-pre-line">{c.back}</div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {(c.tags ?? []).slice(0, 5).map(tag => (
                  <span key={tag} className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{tag}</span>
                ))}
                <button className="ml-auto btn-ghost text-xs text-red-400 hover:text-red-300" onClick={() => void remove(c.id)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open === "add" && (
        <AddModal
          lessons={lessons}
          onClose={() => setOpen(null)}
          onCreated={c => { setRows(r => [c, ...r]); setOpen(null); }}
        />
      )}
      {open === "extract" && (
        <ExtractModal
          lessons={lessons}
          onClose={() => setOpen(null)}
          onDone={newCards => { setRows(r => [...newCards, ...r]); setOpen(null); }}
        />
      )}
    </>
  );
}

function AddModal({ onClose, onCreated, lessons }: { onClose: () => void; onCreated: (c: F) => void; lessons: LessonOption[] }) {
  const [f, setF] = useState({ lesson_id: "", front: "", back: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!f.front.trim() || !f.back.trim()) { setErr("Front and Back are required."); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: f.lesson_id || null,
          front: f.front.trim(),
          back: f.back.trim(),
          tags: f.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload?.error || "Save failed");
      onCreated(payload.card as F);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-md space-y-3">
        <h3 className="text-lg font-semibold">New Flashcard</h3>
        <div>
          <label className="label">Attach to lesson (optional)</label>
          <select className="input mt-1" value={f.lesson_id} onChange={e => setF({ ...f, lesson_id: e.target.value })}>
            <option value="">— No lesson —</option>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Front (concept / term)</label>
          <textarea className="input mt-1 h-20" placeholder="e.g. Iron deficiency anemia" value={f.front} onChange={e => setF({ ...f, front: e.target.value })} />
        </div>
        <div>
          <label className="label">Back (key facts / bullet points)</label>
          <textarea className="input mt-1 h-28" placeholder="• ↓ Ferritin&#10;• ↑ TIBC&#10;• Microcytic hypochromic" value={f.back} onChange={e => setF({ ...f, back: e.target.value })} />
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input className="input" placeholder="e.g. Hematology, IFOM" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Card"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtractModal({ onClose, lessons, onDone }: { onClose: () => void; lessons: LessonOption[]; onDone: (cards: F[]) => void }) {
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(20);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      let targetLessonId = lessonId;

      // If a file was uploaded, create a lesson from it first
      if (file) {
        targetLessonId = await createLessonFromFile(file, title.trim() || file.name);
      }

      if (!targetLessonId) throw new Error("Choose an existing lesson or upload a source document.");

      const r = await fetch("/api/flashcards/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: targetLessonId, count }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Extraction failed");

      setResult({
        ok: true,
        message: `Extracted ${j.inserted} flashcard${j.inserted === 1 ? "" : "s"} from "${j.source_title || "document"}"${j.subject ? ` — ${j.subject}` : ""}.`,
      });

      // Reload after short delay to show the success message
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Extraction failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-2xl max-h-[92vh] overflow-auto">
        <h3 className="text-lg font-semibold">Extract Flashcards from Document</h3>
        <p className="mt-1 text-sm text-slate-400 leading-6">
          The extraction engine reads your document and identifies high-yield medical facts —
          definitions, lab values, clinical features, treatment protocols — and converts them
          into concise front/back flashcards using the original source wording.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Use an existing lesson</label>
            <select className="input mt-1" value={lessonId} onChange={e => setLessonId(e.target.value)}>
              <option value="">— Upload new file instead —</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>

          <div className="text-xs text-slate-500 text-center">— or upload a new file —</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Upload file (PDF, HTML, TXT, MD, PowerPoint)</label>
              <input className="input mt-1" type="file" accept=".pdf,.html,.htm,.txt,.md,.pptx,.ppt"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setLessonId(""); }} />
              {file && <div className="mt-1 text-xs text-slate-500">{file.name}</div>}
            </div>
            <div>
              <label className="label">Document title (for new file)</label>
              <input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Hematology — Iron deficiency" />
            </div>
          </div>

          <div>
            <label className="label">Max flashcards to extract</label>
            <input className="input" type="number" min={5} max={80} value={count} onChange={e => setCount(Number(e.target.value) || 20)} />
          </div>

          {result && (
            <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${result.ok
              ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-300"
              : "border-red-700/50 bg-red-950/30 text-red-300"}`}>
              {result.ok && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {result.message}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={busy || (!lessonId && !file)} onClick={() => void run()}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : <><FileUp className="h-4 w-4" /> Extract Flashcards</>}
          </button>
        </div>
      </div>
    </div>
  );
}
