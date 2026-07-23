"use client";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FileType2,
  Globe,
  Loader2,
  PencilLine,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type Lesson = {
  id: string;
  title: string;
  kind: string;
  visible: boolean;
  course_id: string | null;
  meta: Record<string, unknown> | null;
};

type Course = { id: string; title: string };

function randomPath(ext: string) {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${token}.${ext}`;
}

function formatBytes(size?: number) {
  if (!size || size < 1) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function viewerHref(lesson: Lesson) {
  const fmt = lesson.kind === "pdf" ? "pdf" : "html";
  return `/api/viewer/${lesson.id}/${fmt}`;
}

function lessonHref(lesson: Lesson) {
  return `/lesson/${lesson.id}`;
}

export default function DocumentsClient({ initial, courses }: { initial: Lesson[]; courses: Course[] }) {
  const [rows, setRows] = useState<Lesson[]>(initial);
  const [tab, setTab] = useState<"all" | "html" | "pdf">("all");
  const [modal, setModal] = useState<null | "html-page" | "html-file" | "pdf">(null);

  const shown = useMemo(() => rows.filter((r) => tab === "all" || r.kind === tab), [rows, tab]);
  const courseName = useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course.title])),
    [courses]
  );

  async function toggle(lesson: Lesson) {
    const r = await fetch("/api/admin/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lesson.id, visible: !lesson.visible }),
    });
    if (r.ok) setRows((list) => list.map((item) => (item.id === lesson.id ? { ...item, visible: !item.visible } : item)));
  }

  async function remove(lesson: Lesson) {
    if (!confirm(`Delete \"${lesson.title}\"?`)) return;
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
        Files are uploaded directly to Supabase Storage from the browser for better persistence and faster handling of larger PDFs.
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
          const originalName = typeof lesson.meta?.original_name === "string" ? lesson.meta.original_name : null;
          const fileSize = typeof lesson.meta?.file_size === "number" ? lesson.meta.file_size : null;
          return (
            <div key={lesson.id} className="card p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Icon className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{lesson.title}</div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                    <span className="uppercase">{lesson.kind}</span>
                    {originalName && <span className="break-all">{originalName}</span>}
                    {fileSize && <span>{formatBytes(fileSize)}</span>}
                    {lesson.course_id && courseName[lesson.course_id] && <span>{courseName[lesson.course_id]}</span>}
                    {ragIndexed && <span className="text-brand">RAG</span>}
                    {!lesson.visible && <span className="text-amber-300">Hidden</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <a className="btn-ghost text-xs" href={viewerHref(lesson)} target="_blank" rel="noreferrer">
                  <Eye className="h-3 w-3" /> Viewer
                </a>
                <a className="btn-ghost text-xs" href={lessonHref(lesson)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" /> Page
                </a>
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
  const [ok, setOk] = useState<string | null>(null);

  async function createRow(body: FormData) {
    const r = await fetch("/api/admin/lessons", { method: "POST", body });
    if (!r.ok) throw new Error(await r.text());
    const { lesson } = await r.json();
    return lesson as Lesson;
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (!title.trim()) throw new Error("Title is required");
      if (kind === "html-page" && !html.trim()) throw new Error("HTML content is required");
      if (kind !== "html-page" && !file) throw new Error("Please choose a file first");

      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("course_id", course);
      if (indexText.trim()) fd.set("index_text", indexText.trim());

      if (kind === "html-page") {
        fd.set("kind", "html-inline");
        fd.set("html", html);
      } else {
        const uploadFile = file as File;
        const ext = kind === "pdf" ? "pdf" : uploadFile.name.toLowerCase().endsWith(".htm") ? "htm" : "html";
        const storage_path = randomPath(ext);
        const supabase = createSupabaseClient();
        const { error: uploadError } = await supabase.storage.from("lesson-assets").upload(storage_path, uploadFile, {
          upsert: false,
          contentType: uploadFile.type || (kind === "pdf" ? "application/pdf" : "text/html"),
        });
        if (uploadError) throw new Error(uploadError.message);

        fd.set("kind", kind === "pdf" ? "pdf" : "html-file");
        fd.set("storage_path", storage_path);
        fd.set(
          "meta",
          JSON.stringify({
            original_name: uploadFile.name,
            file_size: uploadFile.size,
            uploaded_via: "browser-direct",
          })
        );
      }

      const lesson = await createRow(fd);
      setOk("Saved successfully");
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
              {file && <div className="mt-2 text-xs text-slate-500">Selected: {file.name} · {formatBytes(file.size)}</div>}
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
          {ok && (
            <p className="text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {ok}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
