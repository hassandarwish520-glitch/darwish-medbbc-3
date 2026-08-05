"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Expand,
  ExternalLink,
  Highlighter,
  Library,
  Maximize2,
  Minimize2,
  PencilLine,
  PlaySquare,
  RefreshCw,
  Save,
  SplitSquareVertical,
  Trash2,
} from "lucide-react";
import LessonViewer from "@/components/LessonViewer";

type LibraryEntry = {
  id: string;
  lesson_id: string | null;
  subject_slug: string | null;
  entry_type: string;
  title: string | null;
  body: string | null;
  quote: string | null;
  color: string;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type Attachment = {
  href: string;
  mime: string;
  name: string;
} | null;

type PanelKey = "notes" | "whiteboard" | "library";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function isHtmlAttachment(attachment: NonNullable<Attachment>) {
  const lower = attachment.name.toLowerCase();
  return attachment.mime.includes("html") || lower.endsWith(".html") || lower.endsWith(".htm");
}

function AttachmentPanel({ attachment }: { attachment: NonNullable<Attachment> }) {
  const isPdf = attachment.mime === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
  const isImage = attachment.mime.startsWith("image/");
  const isHtml = isHtmlAttachment(attachment);
  const [htmlSource, setHtmlSource] = useState("");
  const [loadingHtml, setLoadingHtml] = useState(isHtml);
  const [failedHtml, setFailedHtml] = useState(false);

  useEffect(() => {
    if (!isHtml) {
      setHtmlSource("");
      setLoadingHtml(false);
      setFailedHtml(false);
      return;
    }

    let alive = true;
    setLoadingHtml(true);
    setFailedHtml(false);

    fetch(attachment.href, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("attachment-html-load-failed");
        const text = await response.text();
        if (!alive) return;
        setHtmlSource(text);
        setLoadingHtml(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailedHtml(true);
        setLoadingHtml(false);
      });

    return () => {
      alive = false;
    };
  }, [attachment.href, isHtml]);

  return (
    <div className="flex h-full min-h-[72vh] flex-col border-l border-ink-800 bg-[#08111d] xl:min-h-[84vh]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Attached study file</div>
          <div className="mt-1 text-sm font-semibold text-white">{attachment.name}</div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white">
        {isImage ? (
          <img src={attachment.href} alt={attachment.name} className="block h-full w-full object-contain" draggable={false} />
        ) : isPdf ? (
          <div
            className="relative h-full min-h-[72vh] select-none xl:min-h-[84vh]"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <iframe
              src={`${attachment.href}#toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`}
              className="block h-full min-h-[72vh] w-full bg-white xl:min-h-[84vh]"
              title={attachment.name}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        ) : isHtml ? (
          loadingHtml ? (
            <div className="grid h-full min-h-[72vh] place-items-center px-6 text-center text-sm text-slate-500 xl:min-h-[84vh]">Loading document…</div>
          ) : failedHtml ? (
            <div className="grid h-full min-h-[72vh] place-items-center px-6 text-center text-sm text-red-400 xl:min-h-[84vh]">
              Unable to render this HTML document inside the workspace. Please try refreshing the page.
            </div>
          ) : (
            <iframe
              srcDoc={htmlSource}
              sandbox="allow-same-origin allow-scripts allow-forms"
              className="block h-full min-h-[72vh] w-full bg-white xl:min-h-[84vh]"
              title={attachment.name}
            />
          )
        ) : (
          <iframe src={attachment.href} className="block h-full min-h-[72vh] w-full bg-white xl:min-h-[84vh]" title={attachment.name} />
        )}
      </div>
    </div>
  );
}

function VideoSessionPanel({ lessonTitle, sessionUrl }: { lessonTitle: string; sessionUrl?: string | null }) {
  return (
    <div className="card overflow-hidden border-ink-800 bg-ink-950/90">
      <div className="border-b border-ink-800 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Video session</div>
            <div className="mt-1 text-lg font-semibold text-white">{lessonTitle}</div>
          </div>
          {sessionUrl ? (
            <a href={sessionUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
              <PlaySquare className="h-4 w-4" /> Open session
            </a>
          ) : null}
        </div>
      </div>
      <div className="grid min-h-[72vh] place-items-center p-8 text-center xl:min-h-[84vh]">
        <div className="max-w-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-brand">
            <PlaySquare className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-2xl font-bold text-white">External video session</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This lesson is a linked session, so the workspace now keeps the screen clean instead of showing an empty white viewer. Open the session directly and review the attached study file beside it.
          </p>
          {sessionUrl ? (
            <div className="mt-5">
              <a href={sessionUrl} target="_blank" rel="noreferrer" className="btn-primary">
                <ExternalLink className="h-4 w-4" /> Open video session
              </a>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-ink-800 bg-ink-900/70 px-4 py-3 text-sm text-slate-400">
              No external video link is attached to this lesson yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudyWorkspace({
  lessonId,
  lessonTitle,
  lessonKind,
  lessonMeta,
  subjectSlug,
  externalAttachment,
  sessionUrl,
}: {
  lessonId: string;
  lessonTitle: string;
  lessonKind: string;
  lessonMeta?: Record<string, unknown> | null;
  subjectSlug?: string | null;
  externalAttachment?: Attachment;
  sessionUrl?: string | null;
}) {
  const [viewMode, setViewMode] = useState<"split" | "focus">("split");
  const [panel, setPanel] = useState<PanelKey>("notes");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [noteTitle, setNoteTitle] = useState(lessonTitle);
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushSize, setBrushSize] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const libRes = await fetch(`/api/medical-library?lesson_id=${encodeURIComponent(lessonId)}&limit=120`, { cache: "no-store" });
      const libData = await libRes.json();
      setEntries(libData.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const width = Math.max(640, Math.floor(parent?.clientWidth || 640));
      canvas.width = width;
      canvas.height = 460;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const highlights = useMemo(() => entries.filter((item) => item.entry_type === "highlight"), [entries]);
  const notes = useMemo(() => entries.filter((item) => item.entry_type === "note"), [entries]);
  const canvases = useMemo(() => entries.filter((item) => item.entry_type === "canvas"), [entries]);
  const immersiveMode = viewMode === "focus" || isFullscreen;

  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveEntry(payload: {
    entry_type: string;
    title?: string | null;
    body?: string | null;
    quote?: string | null;
    color?: string;
    data?: Record<string, unknown>;
  }) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/medical-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: lessonId,
          subject_slug: subjectSlug || null,
          image_paths: [],
          ...payload,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.error === "string" ? body.error : `Save failed (${res.status})`;
        setSaveError(msg);
        return;
      }
      await loadWorkspace();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    if (!noteBody.trim()) return;
    await saveEntry({
      entry_type: "note",
      title: noteTitle.trim() || lessonTitle,
      body: noteBody.trim(),
      color: "#93c5fd",
      data: { source: lessonKind },
    });
    setNoteBody("");
  }

  async function saveCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    await saveEntry({
      entry_type: "canvas",
      title: `${lessonTitle} whiteboard`,
      color: "#fca5a5",
      data: { image, brushColor, brushSize },
    });
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/medical-library?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadWorkspace();
  }

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    canvas.setPointerCapture(event.pointerId);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function toggleFullscreen() {
    const node = workspaceRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await node.requestFullscreen();
  }

  const showAttachmentInsideWorkspace = Boolean(externalAttachment && viewMode === "split");

  return (
    <div
      ref={workspaceRef}
      className={immersiveMode ? "fixed inset-0 z-[90] overflow-auto bg-[#040a12] pt-[calc(env(safe-area-inset-top)+0.85rem)] md:pt-4" : "card overflow-hidden border-ink-800 bg-ink-950/70"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Study workspace</div>
          <div className="mt-1 text-sm text-slate-300">
            Clean reading view with notes, whiteboard, library, and the study file beside the session.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={viewMode === "split" ? "subject-tab active" : "subject-tab"} onClick={() => setViewMode("split")}>
            <SplitSquareVertical className="h-4 w-4" />
            <span>Split</span>
          </button>
          <button type="button" className={viewMode === "focus" ? "subject-tab active" : "subject-tab"} onClick={() => setViewMode((value) => (value === "focus" ? "split" : "focus"))}>
            <Expand className="h-4 w-4" />
            <span>{viewMode === "focus" ? "Exit focus" : "Focus"}</span>
          </button>
          <button type="button" className="subject-tab" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isFullscreen ? "Exit full screen" : "Full screen"}</span>
          </button>
          <button type="button" className="subject-tab" onClick={() => void loadWorkspace()}>
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className={`grid gap-0 ${viewMode === "split" ? "lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]" : "grid-cols-1"}`}>
        <div className="min-w-0 border-b border-ink-800 lg:border-b-0 lg:border-r">
          <div className={`${showAttachmentInsideWorkspace ? "grid xl:grid-cols-2" : "block"}`}>
            <div className="min-w-0 bg-[#040a12]">
              {lessonKind === "video" ? <VideoSessionPanel lessonTitle={lessonTitle} sessionUrl={sessionUrl} /> : <LessonViewer id={lessonId} kind={lessonKind} fileType={typeof lessonMeta?.file_type === "string" ? lessonMeta.file_type : undefined} />}
            </div>
            {showAttachmentInsideWorkspace && externalAttachment ? <AttachmentPanel attachment={externalAttachment} /> : null}
          </div>
        </div>

        <aside className={`${viewMode === "focus" ? "hidden" : "block"} min-w-0 bg-[#08111d]`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 px-4 py-3">
            {[
              { key: "notes", label: "Notes", Icon: PencilLine },
              { key: "whiteboard", label: "Whiteboard", Icon: Highlighter },
              { key: "library", label: "Library", Icon: Library },
            ].map(({ key, label, Icon }) => (
              <button key={key} type="button" className={panel === key ? "subject-tab active" : "subject-tab"} onClick={() => setPanel(key as PanelKey)}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {panel === "notes" && (
            <div className="space-y-4 p-4">
              <div className="rounded-2xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-sm leading-6 text-slate-400">
                Transcript was removed from this layout so the workspace stays clean while solving and reviewing files.
              </div>
              <input className="input" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" />
              <textarea className="input min-h-[240px]" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write concise high-yield bullet notes here..." />
              {saveError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {saveError}
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">Notes are saved in the medical library and remain linked to this lesson.</div>
                <button type="button" className="btn-primary text-sm" disabled={saving || !noteBody.trim()} onClick={() => void saveNote()}>
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save note"}
                </button>
              </div>
              {notes.length ? (
                <div className="space-y-3">
                  {notes.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{entry.title || "Quick note"}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(entry.updated_at)}</div>
                        </div>
                        <button type="button" className="text-slate-500 transition hover:text-red-300" onClick={() => void deleteEntry(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{entry.body}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {panel === "whiteboard" && (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs uppercase tracking-[0.16em] text-slate-500">Pen color</label>
                <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} className="h-10 w-14 rounded-xl border border-ink-700 bg-transparent p-1" />
                <label className="text-xs uppercase tracking-[0.16em] text-slate-500">Size</label>
                <input type="range" min={1} max={10} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
                <button type="button" className="btn-ghost text-xs" onClick={clearCanvas}>Clear</button>
                <button type="button" className="btn-primary text-xs" disabled={saving} onClick={() => void saveCanvas()}>
                  <Save className="h-3.5 w-3.5" /> Save whiteboard
                </button>
              </div>
              <div className="rounded-[28px] border border-ink-800 bg-slate-100 p-3">
                <canvas
                  ref={canvasRef}
                  className="study-canvas block w-full rounded-[20px] bg-white"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>
              {canvases.length ? (
                <div className="space-y-3">
                  {canvases.slice(0, 6).map((entry) => {
                    const image = typeof entry.data?.image === "string" ? entry.data.image : "";
                    return (
                      <div key={entry.id} className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{entry.title || "Whiteboard"}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDate(entry.updated_at)}</div>
                          </div>
                          <button type="button" className="text-slate-500 transition hover:text-red-300" onClick={() => void deleteEntry(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {image ? <img src={image} alt={entry.title || "Whiteboard snapshot"} className="mt-3 w-full rounded-2xl border border-ink-700 bg-white" /> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {panel === "library" && (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-ink-800 bg-ink-900/70 px-3 py-4">
                  <div className="text-2xl font-bold text-white">{notes.length}</div>
                  <div className="mt-1 text-xs text-slate-500">Notes</div>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-900/70 px-3 py-4">
                  <div className="text-2xl font-bold text-white">{highlights.length}</div>
                  <div className="mt-1 text-xs text-slate-500">Highlights</div>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-ink-900/70 px-3 py-4">
                  <div className="text-2xl font-bold text-white">{canvases.length}</div>
                  <div className="mt-1 text-xs text-slate-500">Boards</div>
                </div>
              </div>
              {loading ? <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5 text-sm text-slate-500">Loading library…</div> : null}
              <div className="space-y-3">
                {entries.length ? entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{entry.entry_type}</div>
                        <div className="mt-1 font-semibold text-white">{entry.title || entry.quote || "Library item"}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDate(entry.updated_at)}</div>
                      </div>
                      <button type="button" className="text-slate-500 transition hover:text-red-300" onClick={() => void deleteEntry(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {entry.quote ? <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">“{entry.quote}”</div> : null}
                    {entry.body ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{entry.body}</div> : null}
                  </div>
                )) : !loading ? (
                  <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5 text-sm text-slate-500">No saved items yet for this lesson.</div>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
