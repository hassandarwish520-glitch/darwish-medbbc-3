"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  FileType2,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  PencilLine,
  Presentation,
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
type SectionKey = "notes" | "qbank";
type UploadKind = "html-page" | "html-file" | "pdf" | "pptx" | "image";

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
    idx++;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function fileType(lesson: Lesson): string {
  return typeof lesson.meta?.file_type === "string" ? lesson.meta.file_type : lesson.kind;
}

function viewerHref(lesson: Lesson) {
  const ft = fileType(lesson);
  if (ft === "pptx") return `/api/viewer/${lesson.id}/pptx`;
  if (ft === "image") return `/api/viewer/${lesson.id}/image`;
  if (lesson.kind === "pdf") return `/api/viewer/${lesson.id}/pdf`;
  return `/api/viewer/${lesson.id}/html`;
}

function lessonSubject(lesson: Lesson) {
  return typeof lesson.meta?.subject === "string" ? lesson.meta.subject : "";
}

function lessonSection(lesson: Lesson): SectionKey | "general" {
  const section = typeof lesson.meta?.section === "string" ? lesson.meta.section : "";
  if (section === "qbank") return "qbank";
  if (section === "notes") return "notes";
  return "general";
}

function sectionBadge(section: SectionKey | "general") {
  if (section === "qbank") return "Active Q-Bank";
  if (section === "notes") return "Notes";
  return "General";
}

export default function DocumentsClient({ initial, courses, subjects }: { initial: Lesson[]; courses: Course[]; subjects: string[] }) {
  const [rows, setRows] = useState<Lesson[]>(initial);
  const [tab, setTab] = useState<"all" | "html" | "pdf" | "pptx" | "image">("all");
  const [modal, setModal] = useState<null | UploadKind>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);

  const shown = useMemo(
    () => rows.filter((r) => tab === "all" || r.kind === tab || (tab === "html" && (r.kind === "html-file" || r.kind === "html-inline"))),
    [rows, tab],
  );
  const courseName = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c.title])), [courses]);

  async function toggle(lesson: Lesson) {
    const r = await fetch("/api/admin/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lesson.id, visible: !lesson.visible }),
    });
    if (r.ok) {
      const payload = await r.json().catch(() => ({}));
      setRows((list) => list.map((item) => item.id === lesson.id ? ((payload.lesson as Lesson | undefined) ?? { ...item, visible: !item.visible }) : item));
    }
  }

  async function remove(lesson: Lesson) {
    if (!confirm(`Delete "${lesson.title}"? This will also remove all extracted questions and flashcards from this document.`)) return;
    const r = await fetch(`/api/admin/lessons?id=${lesson.id}`, { method: "DELETE" });
    if (r.ok) setRows((list) => list.filter((item) => item.id !== lesson.id));
    else {
      const payload = await r.json().catch(() => ({}));
      alert(payload?.error || "Delete failed");
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setModal("html-page")} className="btn-ghost"><PencilLine className="h-4 w-4" /> Write HTML Page</button>
        <button onClick={() => setModal("html-file")} className="btn-ghost"><Globe className="h-4 w-4" /> Upload HTML File</button>
        <button onClick={() => setModal("pdf")} className="btn-primary"><Upload className="h-4 w-4" /> Upload PDF</button>
        <button onClick={() => setModal("pptx")} className="btn-ghost"><Presentation className="h-4 w-4" /> Upload PowerPoint</button>
        <button onClick={() => setModal("image")} className="btn-ghost"><ImageIcon className="h-4 w-4" /> Upload Image</button>
      </div>

      <div className="mt-3 text-xs leading-6 text-slate-500">
        Choose the main subject and where the document should appear. Q-Bank documents are automatically routed to the Active Q-Bank section and can import their questions into subject Q-Bank sessions.
      </div>

      <div className="flex flex-wrap gap-2 mt-4 text-sm">
        {(["all", "html", "pdf", "pptx", "image"] as const).map((value) => (
          <button key={value} onClick={() => setTab(value)} className={`px-3 py-1 rounded-full ${tab === value ? "bg-brand text-ink-950" : "bg-ink-800 text-slate-300"}`}>
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {!shown.length && <div className="card p-12 text-center"><BookOpen className="h-8 w-8 mx-auto text-slate-500" /><div className="mt-3 text-slate-400">No documents yet. Upload a PDF or HTML file to get started.</div></div>}
        {shown.map((lesson) => {
          const Icon = lesson.kind === "pdf" ? FileType2 : FileText;
          const originalName = typeof lesson.meta?.original_name === "string" ? lesson.meta.original_name : null;
          const fileSize = typeof lesson.meta?.file_size === "number" ? lesson.meta.file_size : null;
          const section = lessonSection(lesson);
          const subject = lessonSubject(lesson);
          return (
            <div key={lesson.id} className="card p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className="h-5 w-5 text-brand mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-white">{lesson.title}</div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                      <span className="uppercase">{lesson.kind}</span>
                      <span className={`rounded-full border px-2 py-0.5 ${section === "qbank" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : section === "notes" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" : "border-ink-700 bg-ink-800 text-slate-300"}`}>{sectionBadge(section)}</span>
                      {subject && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{subject}</span>}
                      {originalName && <span className="break-all">{originalName}</span>}
                      {fileSize && <span>{formatBytes(fileSize)}</span>}
                      {lesson.course_id && courseName[lesson.course_id] && <span>{courseName[lesson.course_id]}</span>}
                      {!lesson.visible && <span className="text-amber-300">Hidden</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {(fileType(lesson) === "pptx" || fileType(lesson) === "image") ? (
                    <a className="btn-ghost text-xs" href={viewerHref(lesson)} target="_blank" rel="noreferrer"><Download className="h-3 w-3" /> Download</a>
                  ) : (
                    <a className="btn-ghost text-xs" href={viewerHref(lesson)} target="_blank" rel="noreferrer"><Eye className="h-3 w-3" /> View</a>
                  )}
                  <a className="btn-ghost text-xs" href={`/lesson/${lesson.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> Page</a>
                  <button className="btn-ghost text-xs" onClick={() => setEditing(lesson)}><Layers className="h-3 w-3" /> Edit placement</button>
                  <button className="btn-ghost text-xs" onClick={() => toggle(lesson)}>{lesson.visible ? <><Eye className="h-3 w-3" /> Visible</> : <><EyeOff className="h-3 w-3" /> Hidden</>}</button>
                  <button className="btn-ghost text-xs text-red-400 hover:text-red-300" onClick={() => void remove(lesson)}><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <UploadModal kind={modal} courses={courses} subjects={subjects} onClose={() => setModal(null)} onCreated={(lesson) => { setRows((list) => [lesson, ...list]); setModal(null); }} />}
      {editing && <EditPlacementModal lesson={editing} courses={courses} subjects={subjects} onClose={() => setEditing(null)} onSaved={(lesson) => { setRows((list) => list.map((item) => (item.id === lesson.id ? lesson : item))); setEditing(null); }} />}
    </>
  );
}

const CUSTOM_SUBJECT_SENTINEL = "__custom__";

/** Select from existing subjects or type a new one */
function SubjectCombo({
  id,
  value,
  onChange,
  subjects,
  placeholder = "Type or choose a subject",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  subjects: string[];
  placeholder?: string;
}) {
  // Whether the current value matches one of the known subjects
  const isKnown = subjects.includes(value.trim());
  // Show custom text input when value is set but not in list, or user picked sentinel
  const showCustom = value === CUSTOM_SUBJECT_SENTINEL || (value.trim() !== "" && !isKnown);
  // The value shown in the select: if current value is in the list use it, else sentinel
  const selectValue = isKnown ? value : CUSTOM_SUBJECT_SENTINEL;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === CUSTOM_SUBJECT_SENTINEL) {
      onChange(""); // clear so the user can type
    } else {
      onChange(v);
    }
  }

  return (
    <>
      <select
        id={id}
        className="input mt-1"
        value={selectValue}
        onChange={handleSelectChange}
      >
        <option value={CUSTOM_SUBJECT_SENTINEL}>{subjects.length ? "— type a new subject —" : "— type below —"}</option>
        {subjects.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {showCustom && (
        <input
          className="input mt-1"
          value={value === CUSTOM_SUBJECT_SENTINEL ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      )}
      {value.trim() && !isKnown && value !== CUSTOM_SUBJECT_SENTINEL && (
        <p className="mt-1 text-[11px] text-amber-400">
          New subject — it will be saved as typed and will match documents with this exact name.
        </p>
      )}
    </>
  );
}

function UploadModal({
  kind,
  courses,
  subjects,
  onClose,
  onCreated,
}: {
  kind: UploadKind;
  courses: Course[];
  subjects: string[];
  onClose: () => void;
  onCreated: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState<SectionKey>("notes");
  const [html, setHtml] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (!title.trim()) throw new Error("Title is required");
      if (kind === "html-page" && !html.trim()) throw new Error("HTML content is required");
      if (kind !== "html-page" && !file) throw new Error("Please choose a file first");
      if (!subject.trim()) throw new Error("Please choose or type a subject");

      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("course_id", course);
      fd.set("meta", JSON.stringify({ subject: subject.trim(), section }));

      if (kind === "html-page") {
        fd.set("kind", "html-inline");
        fd.set("html", html);
      } else {
        const uploadFile = file as File;
        let ext: string;
        let contentType: string;
        let lessonKind: string;

        if (kind === "pdf") {
          ext = "pdf";
          contentType = "application/pdf";
          lessonKind = "pdf";
        } else if (kind === "pptx") {
          ext = uploadFile.name.toLowerCase().endsWith(".ppt") ? "ppt" : "pptx";
          contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          lessonKind = "pptx";
        } else if (kind === "image") {
          const lower = uploadFile.name.toLowerCase();
          ext = lower.endsWith(".png") ? "png" : lower.endsWith(".webp") ? "webp" : lower.endsWith(".gif") ? "gif" : "jpg";
          contentType = uploadFile.type || "image/jpeg";
          lessonKind = "image";
        } else {
          ext = uploadFile.name.toLowerCase().endsWith(".htm") ? "htm" : "html";
          contentType = "text/html";
          lessonKind = "html-file";
        }

        const storage_path = randomPath(ext);
        const supabase = createSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from("lesson-assets")
          .upload(storage_path, uploadFile, { upsert: false, contentType });
        if (uploadError) throw new Error(uploadError.message);
        fd.set("kind", lessonKind);
        fd.set("storage_path", storage_path);
        fd.set(
          "meta",
          JSON.stringify({ subject: subject.trim(), section, original_name: uploadFile.name, file_size: uploadFile.size }),
        );
      }

      const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const { lesson, imported } = await r.json();
      setOk(
        section === "qbank"
          ? `Document saved. ${imported?.inserted ?? 0} questions were linked to the "${subject.trim()}" Q-Bank.`
          : `Document saved and assigned to "${subject.trim()}".`,
      );
      onCreated(lesson as Lesson);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-2xl max-h-[90dvh] overflow-y-auto">
        <h3 className="text-lg font-semibold">
          {kind === "html-page" ? "New HTML Page"
            : kind === "html-file" ? "Upload HTML File"
            : kind === "pptx" ? "Upload PowerPoint"
            : kind === "image" ? "Upload Image"
            : "Upload PDF"}
        </h3>

        <div className="mt-3 space-y-3">
          {/* Title */}
          <div>
            <label className="label" htmlFor="um-title">Title</label>
            <input id="um-title" className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </div>

          {/* Subject + Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="um-subject">
                Subject <span className="text-red-400">*</span>
              </label>
              <SubjectCombo id="um-subject" value={subject} onChange={setSubject} subjects={subjects} />
            </div>
            <div>
              <label className="label" htmlFor="um-section">Section</label>
              <select id="um-section" className="input mt-1" value={section} onChange={(e) => setSection(e.target.value as SectionKey)}>
                <option value="notes">Notes Documents</option>
                <option value="qbank">Active Q-Bank HTML Documents</option>
              </select>
            </div>
          </div>

          {/* Course */}
          <div>
            <label className="label" htmlFor="um-course">Course (optional)</label>
            <select id="um-course" className="input mt-1" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">— none —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* HTML editor */}
          {kind === "html-page" && (
            <div>
              <label className="label" htmlFor="um-html">HTML content</label>
              <textarea id="um-html" className="input mt-1 h-64 font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} placeholder="<html>…</html>" />
            </div>
          )}

          {/* File upload */}
          {kind !== "html-page" && (
            <div>
              <label className="label" htmlFor="um-file">File</label>
              <input
                id="um-file"
                className="input mt-1"
                type="file"
                accept={
                  kind === "pdf" ? "application/pdf,.pdf"
                  : kind === "pptx" ? ".pptx,.ppt,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  : kind === "image" ? "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  : "text/html,.html,.htm"
                }
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <div className="mt-1 text-xs text-slate-500">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-ink-800 bg-ink-900/70 p-3 text-xs text-slate-400">
            Documents are shown <span className="text-white font-medium">only</span> under the subject you choose here — no automatic guessing.
            If you choose <span className="text-white font-medium">Active Q-Bank</span>, the document&apos;s questions will be linked to that subject&apos;s Q-Bank sessions.
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}
          {ok && (
            <p className="text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {ok}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Document"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPlacementModal({
  lesson,
  courses,
  subjects,
  onClose,
  onSaved,
}: {
  lesson: Lesson;
  courses: Course[];
  subjects: string[];
  onClose: () => void;
  onSaved: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [course, setCourse] = useState(lesson.course_id ?? "");
  const [subject, setSubject] = useState(lessonSubject(lesson));
  const [section, setSection] = useState<SectionKey>(lessonSection(lesson) === "qbank" ? "qbank" : "notes");
  const [visible, setVisible] = useState(Boolean(lesson.visible));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (!title.trim()) throw new Error("Title is required");
      if (!subject.trim()) throw new Error("Please choose or type a subject");
      const mergedMeta = { ...(lesson.meta ?? {}), subject: subject.trim(), section };
      const r = await fetch("/api/admin/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lesson.id, title: title.trim(), course_id: course || null, visible, meta: mergedMeta }),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload?.error || "Failed to update document");
      onSaved((payload.lesson as Lesson) ?? { ...lesson, title: title.trim(), course_id: course || null, visible, meta: mergedMeta });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-xl">
        <h3 className="text-lg font-semibold">Edit document placement</h3>

        <div className="mt-3 space-y-3">
          {/* Title */}
          <div>
            <label className="label" htmlFor="ep-title">Title</label>
            <input id="ep-title" className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Subject + Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ep-subject">
                Subject <span className="text-red-400">*</span>
              </label>
              <SubjectCombo id="ep-subject" value={subject} onChange={setSubject} subjects={subjects} />
            </div>
            <div>
              <label className="label" htmlFor="ep-section">Section</label>
              <select id="ep-section" className="input mt-1" value={section} onChange={(e) => setSection(e.target.value as SectionKey)}>
                <option value="notes">Notes Documents</option>
                <option value="qbank">Active Q-Bank HTML Documents</option>
              </select>
            </div>
          </div>

          {/* Course */}
          <div>
            <label className="label" htmlFor="ep-course">Course (optional)</label>
            <select id="ep-course" className="input mt-1" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">— none —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            Visible to students
          </label>

          <div className="rounded-2xl border border-ink-800 bg-ink-900/70 p-3 text-xs text-slate-400">
            The subject you set here is the <span className="text-white font-medium">only</span> way this document appears under a subject — automatic guessing is off.
            You can type a new subject name to create a new category instantly.
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
