"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle,
  FileUp,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Upload,
  X,
} from "lucide-react";

type Course = { id: string; title: string };
type Lesson = { id: string; title: string; course_id: string | null };

type Mode = "upload" | "manual";

export default function FlashcardsImporter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("upload");

  // ── upload mode state ──────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(30);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── manual mode state ─────────────────────────────────────────────────────
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [manualLessonId, setManualLessonId] = useState("");
  const [manualCourseId, setManualCourseId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // ── shared state ──────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("/api/flashcards/import-options");
        if (!res.ok) return;
        const data = await res.json();
        setCourses(data.courses ?? []);
        setLessons(data.lessons ?? []);
      } catch {
        /* silent */
      }
    })();
  }, [open]);

  function reset() {
    setFile(null);
    setTitle("");
    setLessonId("");
    setCourseId("");
    setCount(30);
    setFront("");
    setBack("");
    setManualLessonId("");
    setManualCourseId("");
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    if (imageRef.current) imageRef.current.value = "";
  }

  function close() {
    setOpen(false);
    reset();
  }

  const filteredLessons = courseId
    ? lessons.filter((l) => l.course_id === courseId)
    : lessons;

  const filteredManualLessons = manualCourseId
    ? lessons.filter((l) => l.course_id === manualCourseId)
    : lessons;

  // ── upload mode handler ───────────────────────────────────────────────────
  async function runUpload() {
    if (!file && !lessonId) {
      setResult({ ok: false, message: "Choose an existing lesson or upload a new source file." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.set("file", file);
      if (title.trim()) fd.set("title", title.trim());
      if (courseId) fd.set("course_id", courseId);
      if (lessonId) fd.set("lesson_id", lessonId);
      fd.set("count", String(count));

      const res = await fetch("/api/flashcards/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");

      setResult({
        ok: true,
        message: `Extracted ${data.inserted} flashcard${data.inserted === 1 ? "" : "s"} from "${data.source_title || file?.name || "document"}".`,
      });
      setTimeout(() => { close(); router.refresh(); }, 1400);
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  // ── manual mode handler ───────────────────────────────────────────────────
  async function runManual() {
    if (!front.trim() || !back.trim()) {
      setResult({ ok: false, message: "Please fill in both the front and back of the card." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      let image_url: string | null = null;

      // If an image is attached, convert to data-URL (stored as-is for now)
      if (imageFile) {
        const reader = new FileReader();
        image_url = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      const res = await fetch("/api/flashcards/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: front.trim(),
          back: back.trim(),
          lesson_id: manualLessonId || null,
          image_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save card");

      setResult({ ok: true, message: "Flashcard saved successfully!" });
      // Clear fields for next card — keep modal open
      setFront("");
      setBack("");
      setImageFile(null);
      setImagePreview(null);
      if (imageRef.current) imageRef.current.value = "";
      router.refresh();
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Failed to save card" });
    } finally {
      setBusy(false);
    }
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setImagePreview(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-white flex w-full items-center justify-center gap-2 text-base"
      >
        <Plus className="h-5 w-5" /> Add Flashcards
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-2xl shadow-2xl"
            style={{ background: "var(--c-modal)", border: "1px solid var(--c-border)" }}>

            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-6 pb-4"
              style={{ background: "var(--c-modal)", borderBottom: "1px solid var(--c-border-subtle)" }}>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--c-text-1)" }}>
                  Add Flashcards
                </h2>
                <p className="mt-0.5 text-sm" style={{ color: "var(--c-text-3)" }}>
                  Create manually or extract from a document
                </p>
              </div>
              <button onClick={close} style={{ color: "var(--c-text-3)" }}
                className="hover:opacity-70 transition-opacity">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode switcher */}
            <div className="flex gap-2 px-6 pt-5">
              <button
                onClick={() => { setMode("manual"); setResult(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  mode === "manual"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : ""
                }`}
                style={mode !== "manual" ? {
                  borderColor: "var(--c-border)",
                  background: "var(--c-elevated)",
                  color: "var(--c-text-2)",
                } : {}}
              >
                <PenLine className="h-4 w-4" /> Create manually
              </button>
              <button
                onClick={() => { setMode("upload"); setResult(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  mode === "upload"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : ""
                }`}
                style={mode !== "upload" ? {
                  borderColor: "var(--c-border)",
                  background: "var(--c-elevated)",
                  color: "var(--c-text-2)",
                } : {}}
              >
                <Upload className="h-4 w-4" /> Import from file
              </button>
            </div>

            <div className="px-6 pb-6 pt-5 space-y-4">

              {/* ── MANUAL MODE ─────────────────────────────────────────── */}
              {mode === "manual" && (
                <>
                  {/* Course + Lesson selectors */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Course (optional)</label>
                      <select
                        className="input mt-1"
                        value={manualCourseId}
                        onChange={(e) => { setManualCourseId(e.target.value); setManualLessonId(""); }}
                      >
                        <option value="">— Any course —</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Link to lesson (optional)</label>
                      <select
                        className="input mt-1"
                        value={manualLessonId}
                        onChange={(e) => setManualLessonId(e.target.value)}
                      >
                        <option value="">— Standalone card —</option>
                        {filteredManualLessons.map((l) => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Front */}
                  <div>
                    <label className="label">Front of card <span className="text-red-400">*</span></label>
                    <textarea
                      className="input mt-1 resize-none"
                      rows={3}
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      placeholder="Question or concept — e.g. What is the first-line treatment for Iron Deficiency Anaemia?"
                    />
                  </div>

                  {/* Back */}
                  <div>
                    <label className="label">Back of card <span className="text-red-400">*</span></label>
                    <textarea
                      className="input mt-1 resize-none"
                      rows={4}
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      placeholder="Answer or explanation — e.g. Oral ferrous sulfate 200 mg three times daily for 3–6 months. Check Hb and ferritin after 4 weeks."
                    />
                  </div>

                  {/* Image attachment */}
                  <div>
                    <label className="label">Medical image (optional)</label>
                    <div
                      className="mt-1 rounded-xl border-2 border-dashed p-4 text-center transition cursor-pointer hover:opacity-80"
                      style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}
                      onClick={() => imageRef.current?.click()}
                    >
                      {imagePreview ? (
                        <div className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imagePreview}
                            alt="preview"
                            className="mx-auto max-h-48 rounded-lg object-contain"
                          />
                          <button
                            type="button"
                            className="absolute -top-2 -right-2 rounded-full bg-red-500 p-0.5 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageFile(null);
                              setImagePreview(null);
                              if (imageRef.current) imageRef.current.value = "";
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <ImageIcon className="h-8 w-8 opacity-40" style={{ color: "var(--c-text-3)" }} />
                          <div className="text-sm" style={{ color: "var(--c-text-3)" }}>
                            Tap to attach a medical image, slide, or diagram
                          </div>
                          <div className="text-xs" style={{ color: "var(--c-text-4)" }}>
                            JPG, PNG, WEBP — max 10 MB
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={imageRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={onImageChange}
                    />
                  </div>

                  {result && (
                    <div
                      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                        result.ok
                          ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-600 dark:text-emerald-300"
                          : "border-red-700/50 bg-red-950/20 text-red-600 dark:text-red-300"
                      }`}
                    >
                      {result.ok && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>{result.message}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button className="btn-ghost" onClick={close}>Done</button>
                    <button
                      className="btn-primary"
                      disabled={busy || !front.trim() || !back.trim()}
                      onClick={() => void runManual()}
                    >
                      {busy ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                      ) : (
                        <><BookOpen className="h-4 w-4" /> Save card</>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* ── UPLOAD MODE ─────────────────────────────────────────── */}
              {mode === "upload" && (
                <>
                  <p className="text-sm leading-6" style={{ color: "var(--c-text-3)" }}>
                    The extractor reads your document verbatim — it pulls definitions, features,
                    lab values, and management steps{" "}
                    <strong style={{ color: "var(--c-text-2)" }}>as written</strong>. No invented
                    content, no outlines.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Course (optional)</label>
                      <select
                        className="input mt-1"
                        value={courseId}
                        onChange={(e) => { setCourseId(e.target.value); setLessonId(""); }}
                      >
                        <option value="">— Any course —</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Attach to existing lesson</label>
                      <select
                        className="input mt-1"
                        value={lessonId}
                        onChange={(e) => { setLessonId(e.target.value); if (e.target.value) setFile(null); }}
                      >
                        <option value="">— Upload new file instead —</option>
                        {filteredLessons.map((l) => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-center text-xs uppercase tracking-widest"
                    style={{ color: "var(--c-text-4)" }}>
                    — or upload a new source file —
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        File (PDF, HTML, TXT, MD, PPT, PPTX, JPG, PNG)
                      </label>
                      <input
                        ref={fileRef}
                        className="input mt-1"
                        type="file"
                        accept=".pdf,.html,.htm,.txt,.md,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          setFile(e.target.files?.[0] ?? null);
                          if (e.target.files?.[0]) setLessonId("");
                        }}
                      />
                      {file && (
                        <div className="mt-1 text-xs" style={{ color: "var(--c-text-4)" }}>
                          {file.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label">Lesson title (for new file)</label>
                      <input
                        className="input mt-1"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Hematology — Iron deficiency"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Max cards to extract (5 – 80)</label>
                    <input
                      className="input"
                      type="number"
                      min={5}
                      max={80}
                      value={count}
                      onChange={(e) =>
                        setCount(Math.max(5, Math.min(80, Number(e.target.value) || 30)))
                      }
                    />
                  </div>

                  {result && (
                    <div
                      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                        result.ok
                          ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-600 dark:text-emerald-300"
                          : "border-red-700/50 bg-red-950/20 text-red-600 dark:text-red-300"
                      }`}
                    >
                      {result.ok && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>{result.message}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button className="btn-ghost" onClick={close}>Cancel</button>
                    <button
                      className="btn-primary"
                      disabled={busy || (!file && !lessonId)}
                      onClick={() => void runUpload()}
                    >
                      {busy ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</>
                      ) : (
                        <><FileUp className="h-4 w-4" /> Extract Flashcards</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
