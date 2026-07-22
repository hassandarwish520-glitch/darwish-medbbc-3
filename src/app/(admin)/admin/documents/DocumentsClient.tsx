"use client";
import { useState } from "react";
import { Eye, EyeOff, FileText, FileType2, Globe, PencilLine, Trash2, Upload } from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  kind: string;
  visible: boolean;
  course_id: string | null;
  meta: Record<string, unknown> | null;
};

type Course = { id: string; title: string };

export default function DocumentsClient({ initial, courses }: { initial: Lesson[]; courses: Course[] }) {
  const [rows, setRows] = useState<Lesson[]>(initial);
  const [tab, setTab] = useState<"all" | "html" | "pdf">("all");
  const [modal, setModal] = useState<null | "html-page" | "html-file" | "pdf">(null);

  const shown = rows.filter((r) => tab === "all" || r.kind === tab);

  async function toggle(lesson: Lesson) {
    const r = await fetch("/api/admin/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lesson.id, visible: !lesson.visible }),
    });
    if (r.ok) setRows((list) => list.map((item) => (item.id === lesson.id ? { ...item, visible: !item.visible } : item)));
  }

  async function remove(lesson: Lesson) {
    if (!confirm(`Delete "${lesson.title}"?`)) return;
    const r = await fetch(`/api/admin/lessons?id=${lesson.id}`, { method: "DELETE" });
    if (r.ok) setRows((list) => list.filter((item) => item.id !== lesson.id));
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => setModal("html-page")} className="btn-ghost">
          <PencilLine className="h-4 w-4" /> Write HTML Page
        </button>
        <button onClick={() => setModal("html-file")} className="btn-ghost">
          <Globe className="h-4 w-4" /> Upload HTML File
        </button>
        <button onClick={() => setModal("pdf")} className="btn-primary">
          <Upload className="h-4 w-4" /> Upload PDF
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        HTML is preserved in the secure internal viewer. PDFs can also be indexed for AI Tutor by adding RAG text / notes.
      </div>

      <div className="flex gap-2 mt-4 text-sm">
        {(["all", "html", "pdf"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-3 py-1 rounded-full ${tab === value ? "bg-brand text-ink-950" : "bg-ink-800 text-slate-300"}`}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map((lesson) => {
          const Icon = lesson.kind === "pdf" ? FileType2 : FileText;
          const ragIndexed = typeof lesson.meta?.index_text === "string" && lesson.meta.index_text.length > 0;
          return (
            <div key={lesson.id} className="card p-3 flex items-center gap-3">
              <Icon className="h-5 w-5 text-brand" />
              <div className="flex-1">
                <div className="font-medium">{lesson.title}</div>
                <div className="text-xs text-slate-500 uppercase flex gap-2">
                  <span>{lesson.kind}</span>
                  {ragIndexed && <span className="text-brand">RAG</span>}
                </div>
              </div>
              <button className="btn-ghost text-xs" onClick={() => toggle(lesson)}>
                {lesson.visible ? (
                  <>
                    <Eye className="h-3 w-3" /> Visible
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3" /> Hidden
                  </>
                )}
              </button>
              <button className="btn-ghost text-xs" onClick={() => remove(lesson)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {!shown.length && <div className="text-center text-slate-500 py-10">No documents yet.</div>}
      </div>

      {modal && (
        <UploadModal
          kind={modal}
          courses={courses}
          onClose={() => setModal(null)}
          onCreated={(lesson: Lesson) => {
            setRows((list) => [lesson, ...list]);
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function UploadModal({
  kind,
  courses,
  onClose,
  onCreated,
}: {
  kind: "html-page" | "html-file" | "pdf";
  courses: Course[];
  onClose: () => void;
  onCreated: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState<string>("");
  const [html, setHtml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [indexText, setIndexText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("course_id", course);
      if (indexText.trim()) fd.set("index_text", indexText.trim());

      if (kind === "html-page") {
        fd.set("kind", "html-inline");
        fd.set("html", html);
      } else if (kind === "html-file") {
        fd.set("kind", "html-file");
        if (file) fd.set("file", file);
      } else {
        fd.set("kind", "pdf");
        if (file) fd.set("file", file);
      }

      const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const { lesson } = await r.json();
      onCreated(lesson);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-2xl">
        <h3 className="text-lg font-semibold">
          {kind === "html-page" ? "New HTML lesson page" : kind === "html-file" ? "Upload HTML file" : "Upload PDF"}
        </h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
          </div>
          <div>
            <label className="label">Course (optional)</label>
            <select className="input mt-1" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">— none —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {kind === "html-page" && (
            <div>
              <label className="label">HTML content (CSS/JS preserved)</label>
              <textarea
                className="input mt-1 h-64 font-mono text-xs"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<html>…</html>"
              />
            </div>
          )}

          {kind !== "html-page" && (
            <div>
              <label className="label">File</label>
              <input
                className="input mt-1"
                type="file"
                accept={kind === "pdf" ? "application/pdf" : "text/html,.html,.htm"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <div>
            <label className="label">RAG text / notes for AI Tutor (optional, recommended for PDF)</label>
            <textarea
              className="input mt-1 h-28"
              value={indexText}
              onChange={(e) => setIndexText(e.target.value)}
              placeholder="Paste lesson notes, transcript, summary, or OCR text here so AI Tutor can use this document."
            />
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
