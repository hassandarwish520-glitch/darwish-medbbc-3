"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Edit2,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Note = {
  id: string;
  body: string;
  title: string | null;
  lesson_id: string | null;
  lesson_title: string | null;
  course_id: string | null;
  course_title: string | null;
  updated_at: string;
  image_paths: string[];
};

type LessonOption = {
  id: string;
  title: string;
  kind: string;
  course_id: string | null;
  course_title: string | null;
};

type LessonSummary = {
  id: string;
  title: string;
  count: number;
};

type NoteGroup = {
  course_id: string | null;
  course_title: string;
  total: number;
  lessons: LessonSummary[];
  notes: Note[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function previewText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}


function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadNoteImage(file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as { path: string; url: string };
}

export default function NotesClient({
  initial,
  lessons,
}: {
  initial: Note[];
  lessons: LessonOption[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initial);
  const [modal, setModal] = useState<"write" | "import-file" | "import-doc" | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importing, startImport] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  const [selectedLesson, setSelectedLesson] = useState(lessons[0]?.id ?? "");
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState("");

  const grouped = useMemo<NoteGroup[]>(() => {
    const courseMap = new Map<
      string,
      {
        course_id: string | null;
        course_title: string;
        total: number;
        notes: Note[];
        lessonMap: Map<string, LessonSummary>;
      }
    >();

    for (const note of notes) {
      const key = note.course_id ?? "__uncategorised__";
      let bucket = courseMap.get(key);
      if (!bucket) {
        bucket = {
          course_id: note.course_id,
          course_title: note.course_title ?? "General",
          total: 0,
          notes: [],
          lessonMap: new Map<string, LessonSummary>(),
        };
        courseMap.set(key, bucket);
      }

      bucket.notes.push(note);
      bucket.total += 1;

      const lessonKey = note.lesson_id ?? `standalone:${note.id}`;
      const lessonTitle = note.lesson_title ?? "Standalone notes";
      const existingLesson = bucket.lessonMap.get(lessonKey);
      if (existingLesson) {
        existingLesson.count += 1;
      } else {
        bucket.lessonMap.set(lessonKey, {
          id: lessonKey,
          title: lessonTitle,
          count: 1,
        });
      }
    }

    return Array.from(courseMap.values())
      .map((group) => ({
        course_id: group.course_id,
        course_title: group.course_title,
        total: group.total,
        lessons: Array.from(group.lessonMap.values()).sort((a, b) =>
          a.title.localeCompare(b.title),
        ),
        notes: [...group.notes].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [notes]);

  const totalSubjects = grouped.reduce((n, g) => n + g.lessons.length, 0);
  const totalCourses = grouped.filter((g) => g.course_id).length;

  function openWrite(note?: Note) {
    setEditNote(note ?? null);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setLessonId(note?.lesson_id ?? "");
    setImagePaths(note?.image_paths ?? []);
    setError("");
    setModal("write");
  }

  function close() {
    setModal(null);
    setEditNote(null);
    setBody("");
    setTitle("");
    setLessonId("");
    setError("");
    setDocError("");
    setImagePaths([]);
  }

  async function saveNote() {
    if (!body.trim()) {
      setError("Note body cannot be empty.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editNote?.id,
          title: title.trim() || null,
          body: body.trim(),
          lesson_id: lessonId || null,
          meta: { image_paths: imagePaths },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      router.refresh();

      const savedLesson = lessons.find((l) => l.id === (data.note.lesson_id ?? lessonId));
      const saved: Note = {
        id: data.note.id,
        body: data.note.body,
        title:
          data.note.meta?.title ?? data.note.title ?? (title.trim() || null),
        lesson_id: data.note.lesson_id ?? lessonId ?? null,
        lesson_title: savedLesson?.title ?? editNote?.lesson_title ?? null,
        course_id: savedLesson?.course_id ?? editNote?.course_id ?? null,
        course_title: savedLesson?.course_title ?? editNote?.course_title ?? null,
        updated_at: data.note.updated_at,
        image_paths: data.note.meta?.image_paths ?? imagePaths ?? [],
      };

      setNotes((prev) => {
        const filtered = prev.filter((n) => n.id !== saved.id);
        return [saved, ...filtered];
      });
      close();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(note: Note) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/notes?id=${note.id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      router.refresh();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const seedTitle = () => file.name.replace(/\.[^.]+$/, "");

    if (["txt", "md"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string).trim();
        setTitle(seedTitle());
        setBody(text);
        setModal("write");
      };
      reader.readAsText(file);
    } else if (["html", "htm"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result as string;
        setTitle(seedTitle());
        setBody(stripHtml(raw));
        setModal("write");
      };
      reader.readAsText(file);
    } else if (ext === "pdf") {
      startImport(async () => {
        setBusy(true);
        setError("");
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/notes/import", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Import failed");
          setTitle(seedTitle());
          setBody(data.text ?? "");
          setModal("write");
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Import failed");
        } finally {
          setBusy(false);
        }
      });
    } else {
      setError("Unsupported file type. Use .txt, .md, .html, or .pdf");
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  async function importFromDocument() {
    if (!selectedLesson) return;

    setDocBusy(true);
    setDocError("");
    try {
      const res = await fetch(`/api/notes/lesson-text?lesson_id=${selectedLesson}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load document");
      const lesson = lessons.find((l) => l.id === selectedLesson);
      setLessonId(selectedLesson);
      setTitle(data.title ?? lesson?.title ?? "");
      setBody(data.text ?? "");
      setModal("write");
    } catch (e: unknown) {
      setDocError(e instanceof Error ? e.message : "Failed to load document");
    } finally {
      setDocBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => openWrite()}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Note
        </button>
        <button
          onClick={() => {
            setError("");
            setModal("import-doc");
          }}
          className="btn-ghost flex items-center justify-center gap-2"
        >
          <BookOpen className="h-4 w-4" /> Import from Document
        </button>
        <button
          onClick={() => {
            setError("");
            setModal("import-file");
          }}
          className="btn-ghost flex items-center justify-center gap-2"
        >
          <Upload className="h-4 w-4" /> Import from File
        </button>
      </div>

      <div className="card mt-6 flex items-center justify-between px-5 py-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-brand">{notes.length}</div>
          <div className="text-sm text-slate-400">Total notes</div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold">{totalSubjects}</div>
          <div className="text-sm text-slate-400">Subjects</div>
        </div>
        <div className="h-10 w-px bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold">{totalCourses}</div>
          <div className="text-sm text-slate-400">Courses</div>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.03] text-slate-400">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold">No notes yet</h2>
          <p className="mt-3 text-lg leading-8 text-slate-400">
            Add a note manually, import from a course document, or upload a study file.
            Content is taken exactly from the source — nothing invented.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => openWrite()} className="btn-primary">
              Add Your First Note
            </button>
            <button onClick={() => setModal("import-doc")} className="btn-ghost">
              Import from Document
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map((group) => (
            <div key={group.course_id ?? "uncat"}>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
                  {group.course_title}
                </h2>
                <span className="text-xs text-slate-500">· {group.total} notes</span>
              </div>

              <div className="space-y-3">
                {group.notes.map((note) => (
                  <div
                    key={note.id}
                    className="group card relative p-4 transition hover:border-brand/40"
                  >
                    <div className="absolute right-4 top-4 hidden gap-2 group-hover:flex">
                      <button
                        onClick={() => openWrite(note)}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteNote(note)}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="pr-20">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <BookOpen className="h-4 w-4 text-brand" />
                        <span>{note.lesson_title ?? "Standalone note"}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-100">
                        {note.title?.trim() || "Untitled note"}
                      </h3>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {previewText(note.body)}
                      </p>
                      {note.image_paths?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {note.image_paths.slice(0, 3).map((p) => (
                            <img
                              key={p}
                              src={assetHref(p)}
                              alt="Note image"
                              className="h-16 w-20 rounded-lg border border-ink-700 object-cover"
                            />
                          ))}
                          {note.image_paths.length > 3 && (
                            <div className="flex h-16 w-20 items-center justify-center rounded-lg border border-ink-700 bg-ink-800 text-xs text-slate-400">
                              +{note.image_paths.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-slate-500">
                        Updated {timeAgo(note.updated_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === "write" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-ink-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editNote ? "Edit Note" : "Add Note"}</h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              type="text"
              className="mb-3 mt-3 w-full rounded-xl bg-white/5 px-4 py-3 text-base placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <select
              className="mb-3 w-full rounded-xl bg-white/5 px-4 py-3 text-base text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
            >
              <option value="">Standalone note</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.course_title ? `${lesson.course_title} · ${lesson.title}` : lesson.title}
                </option>
              ))}
            </select>

            <textarea
              className="h-64 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-base leading-7 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Paste your notes here — content will be saved exactly as written."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              autoFocus
            />

            {/* Image uploads */}
            <div className="mt-3">
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  setImageUploading(true);
                  setError("");
                  try {
                    const uploaded = await Promise.all(files.map(uploadNoteImage));
                    setImagePaths((prev) => [...prev, ...uploaded.map((u) => u.path)]);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Image upload failed");
                  } finally {
                    setImageUploading(false);
                  }
                }}
              />
              {imagePaths.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {imagePaths.map((p, i) => (
                    <div key={p} className="relative group h-20 w-24 overflow-hidden rounded-xl border border-ink-700">
                      <img src={assetHref(p)} alt="Note image" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImagePaths((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => imgRef.current?.click()}
                disabled={imageUploading}
                className="flex items-center gap-2 rounded-xl border border-dashed border-ink-600 px-3 py-2 text-sm text-slate-400 transition hover:border-brand/50 hover:text-brand"
              >
                {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {imageUploading ? "Uploading…" : "Add Image"}
              </button>
            </div>

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={saveNote}
                disabled={busy}
                className="btn-primary flex items-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
              <button onClick={close} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "import-doc" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-lg rounded-2xl bg-ink-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Import from Document</h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-400">
              Select any uploaded course document. Its full text will be imported exactly as-is — no AI, no invented summaries.
            </p>

            {lessons.length === 0 ? (
              <p className="text-sm text-slate-500">
                No documents have been uploaded yet. Ask an admin to upload course materials.
              </p>
            ) : (
              <>
                <select
                  className="input w-full"
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                >
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.course_title ? `${lesson.course_title} · ${lesson.title}` : lesson.title}
                    </option>
                  ))}
                </select>
                {docError && <p className="mt-3 text-sm text-red-400">{docError}</p>}
                <button
                  className="btn-primary mt-4 flex w-full items-center justify-center gap-2"
                  disabled={docBusy || !selectedLesson}
                  onClick={() => void importFromDocument()}
                >
                  {docBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="h-4 w-4" />
                  )}
                  {docBusy ? "Loading document…" : "Import This Document"}
                </button>
              </>
            )}

            <button onClick={close} className="btn-ghost mt-3 w-full">
              Cancel
            </button>
          </div>
        </div>
      )}

      {modal === "import-file" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-lg rounded-2xl bg-ink-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Import from File</h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              Select a study file from your device. Content is taken exactly as-is — no AI,
              no invented summaries. Supported:{" "}
              <strong className="text-slate-200">.txt · .md · .html · .pdf</strong>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.html,.htm,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy || importing}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {busy || importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {busy || importing ? "Reading file…" : "Choose File"}
            </button>
            <button onClick={close} className="btn-ghost mt-3 w-full">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
