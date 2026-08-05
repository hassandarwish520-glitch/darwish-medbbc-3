"use client";
import { useMemo, useState } from "react";
import { CheckCircle, Download, FileUp, ImagePlus, Package, Plus, Trash2, Video, VideoOff } from "lucide-react";

type Q = {
  id: string;
  stem: string;
  difficulty: string;
  ai_generated: boolean;
  tags: string[];
  image_path?: string | null;
  image_caption?: string | null;
  video_url?: string | null;
};

type LessonOption = { id: string; title: string };

type QuestionFormState = {
  lesson_id: string;
  stem: string;
  A: string;
  B: string;
  C: string;
  D: string;
  E: string;
  answer_key: string;
  explanation: string;
  difficulty: string;
  tags: string;
  image_caption: string;
  video_url: string;
};

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)\/?.*/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadFile(file: File, folder = "questions") {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", folder);
  const r = await fetch("/api/admin/uploads", { method: "POST", body: fd });
  const payload = await r.json();
  if (!r.ok) throw new Error(payload?.error || "Upload failed");
  return payload as { path: string; url: string };
}

function escapeHtml(input: string) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

async function createLessonFromFile(file: File, title: string) {
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
    // All other text-based formats (txt, md, json, js, etc.)
    const raw = await file.text();
    const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;background:#020617;color:#e2e8f0;"><pre style="white-space:pre-wrap;line-height:1.7">${escapeHtml(raw)}</pre></body></html>`;
    fd.set("kind", "html-inline");
    fd.set("html", html);
    fd.set("index_text", raw);
  }

  const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(payload?.error || "Failed to create source lesson");
  return payload.lesson as LessonOption & { id: string };
}

type ExportFormat = "aidoc" | "json" | "markdown" | "zip";

async function downloadExport(format: ExportFormat, ids?: string[]) {
  const url = new URL("/api/admin/qbank/export", window.location.origin);
  url.searchParams.set("format", format);
  if (ids?.length) url.searchParams.set("ids", ids.join(","));
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Export failed (${res.status})`);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const nameMatch = /filename=\"?([^\";]+)\"?/i.exec(disposition);
  const fileName = nameMatch?.[1] || `qbank-export.${format === "markdown" ? "md.zip" : format}`;
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 1000);
}

export default function QBankAdmin({ initial, lessons }: { initial: Q[]; lessons: LessonOption[] }) {
  const [rows, setRows] = useState<Q[]>(initial);
  const [open, setOpen] = useState<null | "add" | "import" | "export">(null);
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);
  const [exportMessage, setExportMessage] = useState<string>("");
  const [videoEdit, setVideoEdit] = useState<{ id: string; current_url: string | null } | null>(null);

  async function runExport(format: ExportFormat) {
    try {
      setExportBusy(format);
      setExportMessage("");
      await downloadExport(format);
      setExportMessage(`Exported ${rows.length} question(s) as .${format === "markdown" ? "md.zip" : format}.`);
    } catch (error: any) {
      setExportMessage(error?.message || "Export failed");
    } finally {
      setExportBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete question?")) return;
    const r = await fetch(`/api/admin/questions?id=${id}`, { method: "DELETE" });
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      alert(payload?.error || "Failed to delete question");
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const counts = useMemo(() => Object.fromEntries(["foundation", "intermediate", "advanced", "expert"].map((d) => [d, rows.filter((r) => r.difficulty === d).length])), [rows]);

  return (
    <>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-brand">QBank Workflow</div>
          <div className="mt-2 text-lg font-semibold text-white">Import documents, extract exact question blocks, keep images and explanations</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">
            The importer now prefers literal question extraction from the source itself: full stems, answer choices, linked medical images, correct-answer blocks, educational objectives, and subject / system / topic labels without changing your existing naming structure.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setOpen("add")}><Plus className="h-4 w-4" /> Add Question</button>
            <button className="btn-ghost" onClick={() => setOpen("import")}><FileUp className="h-4 w-4" /> Import from Document</button>
            <button className="btn-ghost" onClick={() => setOpen("export")}><Package className="h-4 w-4" /> Export</button>
          </div>
          {exportMessage && <div className="mt-3 text-xs text-slate-400">{exportMessage}</div>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {Object.entries(counts).map(([key, value]) => (
            <div key={key} className="card p-3">
              <div className="text-slate-500 uppercase text-[11px] tracking-[0.18em]">{key}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <div className="card p-10 mt-4 text-center text-slate-400">No questions yet.</div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {rows.map((q) => (
            <div key={q.id} className="card overflow-hidden border border-ink-700/80">
              <div className="grid md:grid-cols-[140px_1fr_auto] gap-0">
                <div className="min-h-[140px] border-b md:border-b-0 md:border-r border-ink-700/80 bg-ink-950/80">
                  {q.image_path ? (
                    <img src={assetHref(q.image_path)} alt={q.image_caption || "Question image"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full min-h-[140px] grid place-items-center text-slate-500">
                      <div className="text-center">
                        <ImagePlus className="h-5 w-5 mx-auto" />
                        <div className="mt-2 text-xs">No image</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 min-w-0">
                  <div className="line-clamp-3 text-sm leading-7 text-slate-100">{q.stem}</div>
                  {q.image_caption && <div className="mt-2 text-xs text-slate-400 line-clamp-2">{q.image_caption}</div>}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-brand uppercase">{q.difficulty}</span>
                    {q.ai_generated && <span className="rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-fuchsia-300">Pipeline</span>}
                    {q.tags?.slice(0, 5).map((t) => <span key={t} className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">{t}</span>)}
                  </div>
                </div>
                <div className="p-3 flex md:flex-col justify-end gap-2">
                  <button
                    className={`btn-ghost text-xs ${q.video_url ? "text-brand" : ""}`}
                    title={q.video_url ? "Edit video URL" : "Add video URL"}
                    onClick={() => setVideoEdit({ id: q.id, current_url: q.video_url ?? null })}
                  >
                    {q.video_url ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                    Video
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => void remove(q.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open === "add" && <AddModal lessons={lessons} onClose={() => setOpen(null)} onCreated={(q) => { setRows((list) => [q, ...list]); setOpen(null); }} />}
      {open === "import" && <ImportModal lessons={lessons} onClose={() => setOpen(null)} onDone={() => location.reload()} />}
      {open === "export" && (
        <ExportModal
          total={rows.length}
          busy={exportBusy}
          onClose={() => setOpen(null)}
          onExport={async (fmt) => {
            await runExport(fmt);
            setOpen(null);
          }}
        />
      )}
      {videoEdit && (
        <EditVideoModal
          id={videoEdit.id}
          currentUrl={videoEdit.current_url}
          onClose={() => setVideoEdit(null)}
          onSaved={(id, url) => {
            setRows((rs) => rs.map((r) => r.id === id ? { ...r, video_url: url } : r));
            setVideoEdit(null);
          }}
        />
      )}
    </>
  );
}

function ExportModal({
  total,
  busy,
  onClose,
  onExport,
}: {
  total: number;
  busy: ExportFormat | null;
  onClose: () => void;
  onExport: (format: ExportFormat) => void | Promise<void>;
}) {
  const formats: { id: ExportFormat; title: string; subtitle: string; icon: React.ReactNode }[] = [
    { id: "aidoc", title: ".aidoc AI Document", subtitle: "Self-contained bundle with manifest + markdown + original-quality images.", icon: <Package className="h-4 w-4" /> },
    { id: "json", title: "JSON manifest", subtitle: "Single JSON file describing every question, image reference, tag, and metadata.", icon: <Download className="h-4 w-4" /> },
    { id: "markdown", title: "Markdown package", subtitle: "Human-readable markdown alongside images and JSON manifest, packed as .md.zip.", icon: <Download className="h-4 w-4" /> },
    { id: "zip", title: "ZIP bundle (images + JSON manifest)", subtitle: "Manifest and every referenced image stored as separate files.", icon: <Download className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="card w-full max-w-2xl max-h-[92vh] overflow-auto p-5">
        <h3 className="text-lg font-semibold">Export Question Bank as AI Document</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Exports every question with the exact original layout: stem, all answer choices, correct answer, full explanation, educational objective, subject / system / topic, difficulty, high-yield tags, embedded medical images in original resolution, image positions, tables, figure captions, image references, notes, highlights, flashcards and metadata. Images are stored as separate files, never converted to Base64 or compressed. Re-importing this document restores 100% of the source questions.
        </p>
        <div className="mt-4 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 text-xs text-slate-300">
          {total} question{total === 1 ? "" : "s"} will be included in this export.
        </div>
        <div className="mt-4 grid gap-3">
          {formats.map((format) => (
            <button
              key={format.id}
              className="flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-4 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!!busy}
              onClick={() => void onExport(format.id)}
            >
              <span className="mt-1 rounded-full bg-brand/10 p-2 text-brand">{format.icon}</span>
              <span>
                <span className="block font-semibold text-white">{format.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{format.subtitle}</span>
                {busy === format.id && <span className="mt-2 block text-xs text-brand">Preparing download…</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ lessons, onClose, onCreated }: { lessons: LessonOption[]; onClose: () => void; onCreated: (q: Q) => void }) {
  const [f, setF] = useState<QuestionFormState>({ lesson_id: lessons[0]?.id ?? "", stem: "", A: "", B: "", C: "", D: "", E: "", answer_key: "A", explanation: "", difficulty: "intermediate", tags: "", image_caption: "", video_url: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const set = (k: keyof QuestionFormState, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      let image_path: string | null = null;
      if (imageFile) {
        const uploaded = await uploadFile(imageFile, "questions");
        image_path = uploaded.path;
      }

      const choices = (["A", "B", "C", "D", "E"] as const).filter((key) => f[key].trim()).map((key) => ({ key, text: f[key].trim() }));
      const r = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: f.lesson_id || null, stem: f.stem.trim(), choices, answer_key: f.answer_key, explanation: f.explanation.trim(), difficulty: f.difficulty, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), image_path, image_caption: f.image_caption.trim() || null, video_url: f.video_url.trim() || null }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload?.error || "Failed to save question");
      onCreated(payload.question as Q);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save question");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-3xl max-h-[92vh] overflow-auto">
        <h3 className="text-lg font-semibold">Add Question</h3>
        <div className="mt-3 space-y-3">
          <select className="input" value={f.lesson_id} onChange={(e) => set("lesson_id", e.target.value)}>
            <option value="">— No lesson —</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <textarea className="input h-24" placeholder="Question stem" value={f.stem} onChange={(e) => set("stem", e.target.value)} />
          {(["A", "B", "C", "D", "E"] as const).map((k) => (
            <input key={k} className="input" placeholder={`Choice ${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={f.answer_key} onChange={(e) => set("answer_key", e.target.value)}>
              {["A", "B", "C", "D", "E"].map((k) => <option key={k}>{k}</option>)}
            </select>
            <select className="input" value={f.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              {["foundation", "intermediate", "advanced", "expert"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <textarea className="input h-20" placeholder="Explanation" value={f.explanation} onChange={(e) => set("explanation", e.target.value)} />
          <input className="input" placeholder="Tags (comma separated)" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Medical image (optional)</label>
              <input className="input mt-1" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="label">Image caption</label>
              <input className="input mt-1" value={f.image_caption} onChange={(e) => set("image_caption", e.target.value)} placeholder="e.g. Chest X-ray showing ..." />
            </div>
          </div>
          <div>
            <label className="label">Video Explanation URL (YouTube or direct)</label>
            <input
              className="input mt-1"
              value={f.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://youtube.com/watch?v=... or https://..."
            />
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/** ─── Direct Import Modal — no AI required ──────────────────────────────── */
function ImportModal({ lessons, onClose, onDone }: { lessons: LessonOption[]; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<"direct" | "text" | "blocks">("direct");
  const [file, setFile] = useState<File | null>(null);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [tags, setTags] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; count: number } | { ok: false; msg: string } | null>(null);

  // Text-based pipeline (PDF / HTML / TXT) state
  const [textFile, setTextFile] = useState<File | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [textDifficulty, setTextDifficulty] = useState("intermediate");
  const [textBusy, setTextBusy] = useState(false);
  const [textOut, setTextOut] = useState("");

  // Blocks import state — creates a named QBank lesson block with auto-extracted questions
  const [blocksFiles, setBlocksFiles] = useState<File[]>([]);
  const [blocksSubject, setBlocksSubject] = useState("");
  const [blocksDifficulty, setBlocksDifficulty] = useState("intermediate");
  const [blocksBusy, setBlocksBusy] = useState(false);
  const [blocksOut, setBlocksOut] = useState<Array<{ name: string; ok: boolean; count?: number; msg?: string }>>([]);

  async function runBlocks() {
    if (!blocksFiles.length || !blocksSubject.trim()) return;
    setBlocksBusy(true);
    setBlocksOut([]);
    const results: Array<{ name: string; ok: boolean; count?: number; msg?: string }> = [];

    for (const blockFile of blocksFiles) {
      const title = blockFile.name.replace(/\.[^.]+$/, "");
      try {
        const lower = blockFile.name.toLowerCase();

        // ── Step 1: Create the lesson block (for viewing).
        // We set skip_auto_import: true so the lesson API does NOT run its own
        // question extraction — we use /api/admin/qbank/import below instead,
        // which correctly handles every file format (PDF, HTML, PPTX, TXT, etc.).
        const fd = new FormData();
        fd.set("title", title);
        fd.set("meta", JSON.stringify({ subject: blocksSubject.trim(), section: "qbank", skip_auto_import: true }));

        if (lower.endsWith(".pdf")) {
          fd.set("kind", "pdf");
          fd.set("file", blockFile);
        } else if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
          fd.set("kind", "pptx");
          fd.set("file", blockFile);
        } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
          fd.set("kind", "html-file");
          fd.set("file", blockFile);
        } else {
          // txt, md, etc. — inline HTML
          const raw = await blockFile.text();
          function escHtml(s: string) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
          const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;padding:24px;background:#020617;color:#e2e8f0;"><pre style="white-space:pre-wrap;line-height:1.7">${escHtml(raw)}</pre></body></html>`;
          fd.set("kind", "html-inline");
          fd.set("html", html);
          fd.set("index_text", raw);
        }

        const lessonResp = await fetch("/api/admin/lessons", { method: "POST", body: fd });
        const lessonData = await lessonResp.json().catch(() => ({}));
        if (!lessonResp.ok) throw new Error(lessonData?.error || "Upload failed");
        const lessonId: string | undefined = lessonData?.lesson?.id;

        // ── Step 2: Extract all questions via the dedicated qbank/import route.
        // This route uses the full HTML DOM parser + PDF text extractor, which
        // correctly handles every format and always imports ALL questions.
        const importFd = new FormData();
        importFd.set("file", blockFile);
        importFd.set("difficulty", blocksDifficulty);
        importFd.set("tags", blocksSubject.trim());
        if (lessonId) importFd.set("lesson_id", lessonId);

        const importResp = await fetch("/api/admin/qbank/import", { method: "POST", body: importFd });
        const importData = await importResp.json().catch(() => ({}));

        let importedCount = 0;
        if (importResp.ok) {
          importedCount = importData?.imported ?? importData?.total ?? 0;
        } else if (importResp.status !== 422) {
          // 422 = no questions found in this file — not a fatal error, just report 0
          throw new Error(importData?.error || "Question extraction failed");
        }

        results.push({ name: title, ok: true, count: importedCount });
        setBlocksOut([...results]);
      } catch (e: unknown) {
        results.push({ name: blockFile.name, ok: false, msg: e instanceof Error ? e.message : "Failed" });
        setBlocksOut([...results]);
      }
    }

    setBlocksBusy(false);
    if (results.some((r) => r.ok)) setTimeout(onDone, 1800);
  }

  async function runDirect() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("difficulty", difficulty);
      fd.set("tags", tags);
      if (lessonId) fd.set("lesson_id", lessonId);
      const r = await fetch("/api/admin/qbank/import", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Import failed");
      setResult({ ok: true, count: j.imported ?? j.total ?? 0 });
      setTimeout(onDone, 1200);
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  async function runText() {
    if (!textFile) return;
    setTextBusy(true);
    setTextOut("");
    try {
      const lesson = await createLessonFromFile(textFile, textTitle.trim());
      const r = await fetch("/api/documents/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lesson.id, question_count: 200, flashcard_count: 0, difficulty: textDifficulty }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Extraction failed");
      setTextOut(`Imported ${j?.document?.question_count ?? 0} questions.`);
      setTimeout(onDone, 1000);
    } catch (e: unknown) {
      setTextOut(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setTextBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-2xl max-h-[92vh] overflow-auto">
        <h3 className="text-lg font-semibold">Import Questions from Document</h3>
        <p className="mt-1 text-sm text-slate-400 leading-6">
          Questions are imported exactly as they appear in your document — stems, choices, correct answers, explanations, and medical images — no modifications.
        </p>

        {/* Tab switcher */}
        <div className="mt-4 flex rounded-xl border border-ink-700 overflow-hidden text-sm">
          <button
            className={`flex-1 py-2 font-medium transition ${tab === "direct" ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setTab("direct")}
          >
            JSON / JS
          </button>
          <button
            className={`flex-1 py-2 font-medium transition ${tab === "text" ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setTab("text")}
          >
            PDF / HTML
          </button>
          <button
            className={`flex-1 py-2 font-medium transition ${tab === "blocks" ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setTab("blocks")}
          >
            QBank Blocks
          </button>
        </div>

        {tab === "direct" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-3 text-xs text-slate-400 leading-5">
              Upload a <span className="text-slate-200">.json</span>, <span className="text-slate-200">.js</span>,{" "}
              <span className="text-slate-200">.ts</span>, or any file whose questions are already structured. Each question needs a stem, answer choices, correct answer, and optionally an explanation and image path.
            </div>
            <div>
              <label className="label">Question file</label>
              <input className="input mt-1" type="file" accept="*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Default difficulty</label>
                <select className="input mt-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {["foundation", "intermediate", "advanced", "expert"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Extra tags (comma separated)</label>
                <input className="input mt-1" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Cardiology, IFOM" />
              </div>
            </div>
            <div>
              <label className="label">Attach to lesson (optional)</label>
              <select className="input mt-1" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                <option value="">— None —</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
            {result && (
              <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${result.ok ? "border-green-700/50 bg-green-950/40 text-green-300" : "border-red-700/50 bg-red-950/40 text-red-300"}`}>
                {result.ok ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : null}
                {result.ok ? `${result.count} question${result.count === 1 ? "" : "s"} imported successfully.` : result.msg}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={onClose}>Close</button>
              <button className="btn-primary" disabled={busy || !file} onClick={() => void runDirect()}>
                {busy ? "Importing…" : <><FileUp className="h-4 w-4" /> Import Questions</>}
              </button>
            </div>
          </div>
        )}

        {tab === "text" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-3 text-xs text-slate-400 leading-5">
              For PDF or HTML documents where questions appear as formatted text blocks. The importer reads the document and extracts every question block — stem, choices, answer key, and explanation — exactly as written.
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">Upload file (PDF, HTML, TXT)</label>
                <input className="input mt-1" type="file" accept=".pdf,.html,.htm,.txt,.md,.docx,.pptx,.epub,.zip,.mhtml,.mht" onChange={(e) => setTextFile(e.target.files?.[0] ?? null)} />
              </div>
              <div>
                <label className="label">Document title</label>
                <input className="input mt-1" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="e.g. Cardiology Q-Set" />
              </div>
            </div>
            <div>
              <label className="label">Default difficulty</label>
              <select className="input" value={textDifficulty} onChange={(e) => setTextDifficulty(e.target.value)}>
                {["foundation", "intermediate", "advanced", "expert"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            {textOut && (
              <p className={`text-sm ${textOut.toLowerCase().includes("fail") || textOut.toLowerCase().includes("error") ? "text-red-400" : "text-green-400"}`}>
                {textOut}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={onClose}>Close</button>
              <button className="btn-primary" disabled={textBusy || !textFile} onClick={() => void runText()}>
                {textBusy ? "Extracting…" : <><FileUp className="h-4 w-4" /> Extract Questions</>}
              </button>
            </div>
          </div>
        )}

        {tab === "blocks" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs text-slate-300 leading-5">
              <span className="font-semibold text-brand">QBank Blocks Import</span> — Upload one or more files (PDF, HTML, PPTX, TXT). Each file is saved as a separate Active Q-Bank block under the subject you specify, with all questions auto-extracted and linked. This does not replace existing blocks.
            </div>
            <div>
              <label className="label">Subject <span className="text-red-400">*</span></label>
              <input
                className="input mt-1"
                value={blocksSubject}
                onChange={(e) => setBlocksSubject(e.target.value)}
                placeholder="e.g. Hematology, Cardiology, Pharmacology"
              />
            </div>
            <div>
              <label className="label">Upload files (PDF, HTML, PPTX, TXT — one block per file)</label>
              <input
                className="input mt-1"
                type="file"
                accept=".pdf,.html,.htm,.txt,.md,.pptx,.ppt"
                multiple
                onChange={(e) => setBlocksFiles(Array.from(e.target.files ?? []))}
              />
              {blocksFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {blocksFiles.map((f) => (
                    <span key={f.name} className="rounded-full bg-ink-800 px-2.5 py-1 text-xs text-slate-300">{f.name}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Default difficulty</label>
              <select className="input" value={blocksDifficulty} onChange={(e) => setBlocksDifficulty(e.target.value)}>
                {["foundation", "intermediate", "advanced", "expert"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            {blocksOut.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-ink-700 bg-ink-950/60 p-3">
                {blocksOut.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${r.ok ? "text-green-400" : "text-red-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${r.ok ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="font-medium truncate max-w-[180px]">{r.name}</span>
                    <span className="text-slate-400">{r.ok ? `— ${r.count ?? 0} questions extracted` : `— ${r.msg}`}</span>
                  </div>
                ))}
                {blocksBusy && <div className="text-xs text-slate-400 mt-1">Processing…</div>}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={onClose}>Close</button>
              <button
                className="btn-primary"
                disabled={blocksBusy || !blocksFiles.length || !blocksSubject.trim()}
                onClick={() => void runBlocks()}
              >
                {blocksBusy ? "Importing blocks…" : <><FileUp className="h-4 w-4" /> Create QBank Blocks</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ─── Edit Video Modal ─────────────────────────────────────────────────── */
function EditVideoModal({
  id,
  currentUrl,
  onClose,
  onSaved,
}: {
  id: string;
  currentUrl: string | null;
  onClose: () => void;
  onSaved: (id: string, url: string | null) => void;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, video_url: url.trim() || null }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload?.error || "Failed to save");
      onSaved(id, payload.question?.video_url ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  function getYouTubeId(u: string): string | null {
    const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([A-Za-z0-9_-]{11})/);
    return m?.[1] ?? null;
  }

  const previewId = url.trim() ? getYouTubeId(url.trim()) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="card w-full max-w-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Video className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-semibold">
            {currentUrl ? "Edit Video Explanation" : "Add Video Explanation"}
          </h3>
        </div>

        <p className="text-sm text-slate-400 leading-6 mb-4">
          أضف رابط فيديو شرح للسؤال. سيظهر للطالب تلقائياً بعد كشف الإجابة في قسم الـ Collections.
          يدعم روابط YouTube أو أي رابط فيديو مباشر.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">رابط الفيديو (YouTube أو مباشر)</label>
            <input
              className="input mt-1"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setErr(""); }}
              placeholder="https://youtube.com/watch?v=... أو https://..."
              autoFocus
            />
          </div>

          {/* Live YouTube preview */}
          {previewId && (
            <div className="rounded-2xl overflow-hidden border border-ink-700/80">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-700/80 bg-ink-950/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-red-500">
                  <path d="M23.498 6.186a2.99 2.99 0 0 0-2.11-2.11C19.527 3.5 12 3.5 12 3.5s-7.527 0-9.388.576a2.99 2.99 0 0 0-2.11 2.11C0 8.047 0 12 0 12s0 3.953.502 5.814a2.99 2.99 0 0 0 2.11 2.11C4.473 20.5 12 20.5 12 20.5s7.527 0 9.388-.576a2.99 2.99 0 0 0 2.11-2.11C24 15.953 24 12 24 12s0-3.953-.502-5.814zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
                </svg>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-[0.12em]">معاينة YouTube</span>
              </div>
              <div className="relative" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${previewId}?rel=0&modestbranding=1`}
                  title="Video preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
          )}

          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {/* Remove button (only if there's an existing URL) */}
          {currentUrl ? (
            <button
              className="btn-ghost text-xs text-red-400 hover:text-red-300"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/admin/questions", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, video_url: null }),
                  });
                  const payload = await r.json();
                  if (!r.ok) throw new Error(payload?.error || "Failed");
                  onSaved(id, null);
                } catch (e: unknown) {
                  setErr(e instanceof Error ? e.message : "Failed");
                  setBusy(false);
                }
              }}
            >
              <VideoOff className="h-3.5 w-3.5" /> حذف الفيديو
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onClose} disabled={busy}>إلغاء</button>
            <button
              className="btn-primary"
              disabled={busy || !url.trim()}
              onClick={() => void save()}
            >
              {busy ? "جاري الحفظ…" : <><Video className="h-4 w-4" /> حفظ الفيديو</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
