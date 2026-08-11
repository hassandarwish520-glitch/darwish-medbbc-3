"use client";

/**
 * AnnotationPanel — attachment viewer with navigate / pen / highlighter / eraser,
 * palette, size slider, undo / redo / clear, zoom, light / dark reading mode,
 * reading-mode typography, and native fullscreen. Persists strokes locally and
 * (optionally) to /api/medical-library so they survive reloads.
 *
 * The video lesson workspace (`StudyWorkspace`) owns its own inline attachment
 * view and is intentionally NOT replaced by this component. This panel is for
 * the /documents/[id] workspace.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Expand, Highlighter, Loader2, MoreHorizontal, MousePointer2, PencilLine, Redo2, Undo2 } from "lucide-react";
import { injectProtectionIntoHtml } from "@/lib/protected-html";

export type AnnotationTool = "navigate" | "pen" | "highlighter" | "eraser";
export type AnnotationStroke = {
  tool: AnnotationTool;
  color: string;
  size: number;
  points: { x: number; y: number }[];
};

type AnnotationAttachment = {
  href: string;
  mime: string;
  name: string;
  lessonId?: string | null;
  subjectSlug?: string | null;
  storageKey?: string;
};

const PALETTE = ["#fde047", "#86efac", "#f9a8d4", "#60a5fa", "#a78bfa", "#fdba74"];

function safeStorageGet(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; }
}

function safeStorageSet(key: string, value: string) {
  try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function detectKind(att: AnnotationAttachment) {
  const mime = (att.mime || "").toLowerCase();
  const name = (att.name || "").toLowerCase();
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isImage = mime.startsWith("image/");
  const isHtml = mime.includes("html") || name.endsWith(".html") || name.endsWith(".htm");
  const isVideo = mime.startsWith("video/");
  return { isPdf, isImage, isHtml, isVideo };
}

class AnnotationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unexpected error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[28px] border border-rose-400/40 bg-rose-500/10 p-8 text-center">
          <div className="text-sm font-medium text-rose-200">The annotation viewer crashed: {this.state.message}</div>
          <button
            type="button"
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Reload viewer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AnnotationPanelInner({
  attachment,
  lessonId,
  subjectSlug,
  storageKey,
}: {
  attachment: AnnotationAttachment;
  lessonId?: string | null;
  subjectSlug?: string | null;
  storageKey?: string;
}) {
  const effectiveKey = storageKey || `documentsws:annotations:${attachment.href}`;
  const { isPdf, isImage, isHtml, isVideo } = detectKind(attachment);

  const [htmlSource, setHtmlSource] = useState<string>("");
  const [loadingHtml, setLoadingHtml] = useState<boolean>(isHtml);
  const [failedHtml, setFailedHtml] = useState<boolean>(false);
  const [tool, setTool] = useState<AnnotationTool>("navigate");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [size, setSize] = useState<number>(4);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationStroke[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [annotationReady, setAnnotationReady] = useState(false);
  const [zoom, setZoom] = useState<number>(100);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [readingMode, setReadingMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [htmlFrameHeight, setHtmlFrameHeight] = useState<string>("0px");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const htmlFrameRef = useRef<HTMLIFrameElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<AnnotationStroke | null>(null);
  const strokesRef = useRef<AnnotationStroke[]>([]);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  const renderStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: AnnotationStroke) => {
    if (!stroke?.points?.length) return;
    const validPoints = stroke.points.filter(
      (p) => p && typeof p.x === "number" && typeof p.y === "number" && isFinite(p.x) && isFinite(p.y),
    );
    if (validPoints.length < 2) return;
    try {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = Math.max(12, stroke.size * 3);
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.globalAlpha = 1;
      } else if (stroke.tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = Math.max(14, stroke.size * 3.5);
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.4;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = Math.max(2, stroke.size);
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.moveTo(validPoints[0].x, validPoints[0].y);
      validPoints.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    } catch {
      try { ctx.restore(); } catch { /* noop */ }
    }
  }, []);

  const redrawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch { return; }
    strokesRef.current.forEach((s) => renderStroke(ctx, s));
  }, [renderStroke]);

  const resizeOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    try {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
      redrawOverlay();
    } catch { /* ignore */ }
  }, [redrawOverlay]);

  /* Hydrate from localStorage first */
  useEffect(() => {
    try {
      const raw = safeStorageGet(effectiveKey);
      const local = safeParse<{ strokes: AnnotationStroke[] }>(raw);
      if (local?.strokes?.length) {
        setStrokes(local.strokes);
        strokesRef.current = local.strokes;
      }
    } catch { /* ignore */ }
  }, [effectiveKey]);

  /* Load from server if lessonId known */
  useEffect(() => {
    if (!lessonId) { setAnnotationReady(true); return; }
    let alive = true;
    setAnnotationReady(false);
    setEntryId(null);
    fetch(`/api/medical-library?lesson_id=${encodeURIComponent(lessonId)}&entry_type=attachment&limit=100`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("annotation-load-failed");
        const payload = await res.json().catch(() => ({ entries: [] }));
        if (!alive) return;
        const match = (Array.isArray(payload.entries) ? payload.entries : []).find(
          (entry: { data?: { kind?: string; attachment_href?: string } }) =>
            entry?.data?.kind === "annotation" && entry?.data?.attachment_href === attachment.href,
        );
        const remoteStrokes = Array.isArray(match?.data?.strokes) ? (match.data.strokes as AnnotationStroke[]) : [];
        const local = safeParse<{ strokes: AnnotationStroke[] }>(safeStorageGet(effectiveKey));
        const finalStrokes = remoteStrokes.length ? remoteStrokes : local?.strokes ?? [];
        setStrokes(finalStrokes);
        strokesRef.current = finalStrokes;
        if (match?.id) setEntryId(match.id);
        setAnnotationReady(true);
      })
      .catch(() => { if (alive) setAnnotationReady(true); });

    return () => { alive = false; };
  }, [attachment.href, effectiveKey, lessonId]);

  useEffect(() => {
    if (!annotationReady) return;
    redrawOverlay();
  }, [annotationReady, redrawOverlay, strokes]);

  /* Persist locally */
  useEffect(() => {
    safeStorageSet(effectiveKey, JSON.stringify({ strokes, updatedAt: new Date().toISOString() }));
  }, [effectiveKey, strokes]);

  /* Persist remotely (debounced) */
  useEffect(() => {
    if (!annotationReady || !lessonId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    setSaveError(null);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/medical-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: entryId ?? undefined,
            lesson_id: lessonId,
            subject_slug: subjectSlug || null,
            entry_type: "attachment",
            title: `${attachment.name} annotations`,
            color,
            data: {
              kind: "annotation",
              attachment_href: attachment.href,
              attachment_name: attachment.name,
              strokes,
              updatedAt: new Date().toISOString(),
            },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && typeof payload?.entry?.id === "string") {
          setEntryId(payload.entry.id);
          setSaveStatus("saved");
        } else {
          setSaveError(payload?.error || `Save failed (HTTP ${response.status})`);
          setSaveStatus("idle");
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed");
        setSaveStatus("idle");
      }
    }, 700);

    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [annotationReady, attachment.href, attachment.name, color, entryId, lessonId, strokes, subjectSlug]);

  useEffect(() => {
    resizeOverlay();
    window.addEventListener("resize", resizeOverlay);
    return () => window.removeEventListener("resize", resizeOverlay);
  }, [resizeOverlay]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isHtml) { setHtmlSource(""); setLoadingHtml(false); setFailedHtml(false); return; }
    let alive = true;
    setLoadingHtml(true);
    setFailedHtml(false);
    fetch(attachment.href, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("attachment-html-load-failed");
        const text = await res.text();
        if (!alive) return;
        setHtmlSource(injectProtectionIntoHtml(text));
        setLoadingHtml(false);
      })
      .catch(() => { if (alive) { setFailedHtml(true); setLoadingHtml(false); } });
    return () => { alive = false; };
  }, [attachment.href, isHtml]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const target = event.currentTarget;
    if (!target) return { x: 0, y: 0 };
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 };
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* noop */ }
    currentStrokeRef.current = { tool, color, size, points: [getPoint(event)] };
  };

  const drawStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(getPoint(event));
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) renderStroke(ctx, { ...currentStrokeRef.current, points: currentStrokeRef.current.points.slice(-1) });
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    if (!drawingRef.current || !currentStrokeRef.current) { redrawOverlay(); return; }
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length > 1) {
      setStrokes((prev) => [...prev, stroke]);
      setRedoStack([]);
    } else {
      redrawOverlay();
    }
  };

  const cancelStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    drawingRef.current = false;
    currentStrokeRef.current = null;
    redrawOverlay();
  };

  const undoAnnotation = () => {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const removed = next.pop() as AnnotationStroke;
      setRedoStack((r) => [...r, removed]);
      return next;
    });
  };

  const redoAnnotation = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const restored = next.pop() as AnnotationStroke;
      setStrokes((cur) => [...cur, restored]);
      return next;
    });
  };

  const clearAnnotations = () => {
    setStrokes([]);
    setRedoStack([]);
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 200);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (panelRef.current) await panelRef.current.requestFullscreen();
    } catch { /* ignore */ }
  };

  const frameHeight = readingMode || isFullscreen
    ? "calc(100vh - 9rem)"
    : "clamp(420px, calc(100vh - 18rem), 1180px)";
  const frameWidth = Math.min(1500, Math.round(980 * (zoom / 100)));

  useEffect(() => {
    if (!isHtml || !htmlSource) return;
    const iframe = htmlFrameRef.current;
    if (!iframe) return;

    const syncHtmlHeight = () => {
      try {
        const doc = iframe.contentDocument;
        const bodyHeight = doc?.body?.scrollHeight ?? 0;
        const rootHeight = doc?.documentElement?.scrollHeight ?? 0;
        const nextHeight = Math.max(bodyHeight, rootHeight, 640);
        setHtmlFrameHeight(`${nextHeight}px`);
        window.setTimeout(() => resizeOverlay(), 0);
      } catch {
        setHtmlFrameHeight(frameHeight);
      }
    };

    const handleLoad = () => syncHtmlHeight();
    iframe.addEventListener("load", handleLoad);
    syncHtmlHeight();
    const retry = window.setTimeout(syncHtmlHeight, 250);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      window.clearTimeout(retry);
    };
  }, [frameHeight, htmlSource, isHtml, resizeOverlay]);

  return (
    <div ref={panelRef} className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/90 shadow-[0_20px_70px_rgba(3,7,18,0.45)]">
      <div className="border-b border-white/10 px-4 pt-3 md:px-5">
        <div className="flex items-center gap-6 text-sm">
          <button type="button" className="border-b-2 border-blue-500 pb-2 font-medium text-blue-300">Annotation</button>
          <button type="button" className="border-b-2 border-transparent pb-2 text-slate-400">Details</button>
          <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Synced" : "Local"}
          </span>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white md:text-lg">{attachment.name}</div>
            <div className="mt-1 text-xs text-slate-500">Document workspace — annotated reading</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <button type="button" onClick={() => setZoom((v) => Math.max(70, v - 10))} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/40">−</button>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">{zoom}%</span>
            <button type="button" onClick={() => setZoom((v) => Math.min(220, v + 10))} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/40">+</button>
            <button type="button" onClick={() => setDarkMode((v) => !v)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 hover:border-blue-500/40" title="Toggle light / dark reading mode">
              {darkMode ? "Light" : "Dark"}
            </button>
            <button type="button" onClick={() => setReadingMode((v) => !v)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 hover:border-blue-500/40">
              {readingMode ? "Exit Reading" : "Reading"}
            </button>
            <button type="button" onClick={toggleFullscreen} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/40" title="Toggle fullscreen">
              <Expand className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {!readingMode && (
        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ToolButton active={tool === "navigate"} onClick={() => setTool("navigate")}><MousePointer2 className="mr-1 inline h-3.5 w-3.5" /><span>Navigate</span></ToolButton>
            <ToolButton active={tool === "pen"} onClick={() => setTool("pen")}><PencilLine className="mr-1 inline h-3.5 w-3.5" /><span>Pen</span></ToolButton>
            <ToolButton active={tool === "highlighter"} onClick={() => setTool("highlighter")}><Highlighter className="mr-1 inline h-3.5 w-3.5" /><span>Highlight</span></ToolButton>
            <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser className="mr-1 inline h-3.5 w-3.5" /><span>Eraser</span></ToolButton>
            <IconButton disabled={!strokes.length} onClick={undoAnnotation}><Undo2 className="mr-1 inline h-3.5 w-3.5" /><span>Undo</span></IconButton>
            <IconButton disabled={!redoStack.length} onClick={redoAnnotation}><Redo2 className="mr-1 inline h-3.5 w-3.5" /><span>Redo</span></IconButton>
            <IconButton onClick={clearAnnotations}><MoreHorizontal className="mr-1 inline h-3.5 w-3.5" /><span>Clear</span></IconButton>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {PALETTE.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setColor(entry)}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === entry ? "scale-110 border-white" : "border-transparent"}`}
                  style={{ backgroundColor: entry }}
                  aria-label={`Select ${entry}`}
                />
              ))}
              <input type="range" min={2} max={12} value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-24 accent-blue-500" />
            </div>
          </div>
        </div>
      )}

      <div className={`medbbc-viewer min-h-0 flex-1 overflow-y-auto overflow-x-auto p-3 md:p-5 ${darkMode ? "bg-[#0a1220]" : "bg-[#0c1422]"}`}
           data-medbbc-viewer="annotation"
           style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
           onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <div className="mx-auto flex min-h-full w-full justify-center">
          <div ref={containerRef}
               className={`relative rounded-[24px] border border-white/10 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] ${darkMode ? "[filter:invert(1)_hue-rotate(180deg)]" : ""}`}
               style={{ width: `min(100%, ${frameWidth}px)`, minHeight: frameHeight }}>
            {!annotationReady ? (
              <div className="grid place-items-center text-center text-sm text-slate-500" style={{ height: frameHeight }}>
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : isImage ? (
              <img src={attachment.href} alt={attachment.name} className="block w-full object-contain object-top"
                   style={{ height: "auto" }} draggable={false} />
            ) : isPdf ? (
              <iframe src={`${attachment.href}#toolbar=0&navpanes=0&statusbar=0&view=FitH`}
                      className="block w-full bg-white" style={{ height: frameHeight }} title={attachment.name}
                      sandbox="allow-same-origin allow-scripts" />
            ) : isHtml ? (
              loadingHtml ? (
                <div className="grid place-items-center px-6 text-center text-sm text-slate-500" style={{ height: frameHeight }}>Loading document…</div>
              ) : failedHtml ? (
                <div className="grid place-items-center px-6 text-center text-sm text-rose-400" style={{ height: frameHeight }}>Unable to render this HTML document. Please refresh.</div>
              ) : (
                <iframe ref={htmlFrameRef} srcDoc={htmlSource} sandbox="allow-same-origin allow-scripts allow-forms"
                        data-annotation-html="true"
                        className="block w-full bg-white" style={{ height: htmlFrameHeight || frameHeight, pointerEvents: "auto" }} title={attachment.name} />
              )
            ) : isVideo ? (
              <video src={attachment.href} controls className="block w-full bg-black"
                     style={{ minHeight: frameHeight, maxHeight: frameHeight }} />
            ) : (
              <iframe src={attachment.href} className="block w-full bg-white" style={{ height: frameHeight }} title={attachment.name} />
            )}

            <canvas
              ref={canvasRef}
              className={`absolute inset-0 h-full w-full ${tool === "navigate" ? "pointer-events-none" : "touch-none pointer-events-auto"}`}
              style={{ touchAction: tool === "navigate" ? "auto" : "none" }}
              onPointerDown={tool === "navigate" ? undefined : startStroke}
              onPointerMove={tool === "navigate" ? undefined : drawStroke}
              onPointerUp={tool === "navigate" ? undefined : finishStroke}
              onPointerLeave={tool === "navigate" ? undefined : finishStroke}
              onPointerCancel={tool === "navigate" ? undefined : cancelStroke}
            />

            <button
              type="button"
              onClick={() => setTool(tool === "navigate" ? "pen" : "navigate")}
              aria-label={tool === "navigate" ? "Enable drawing" : "Disable drawing (navigate)"}
              className={`absolute bottom-5 right-5 inline-flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_10px_30px_rgba(59,130,246,0.45)] transition ${tool === "navigate" ? "bg-blue-500" : "bg-emerald-500"}`}
            >
              {tool === "navigate" ? <PencilLine className="h-5 w-5" /> : <MousePointer2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {saveError ? (
        <div className="border-t border-white/10 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">{saveError}</div>
      ) : null}
    </div>
  );
}

function ToolButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
            className={`rounded-xl border px-3 py-1.5 text-xs ${active ? "border-blue-500/40 bg-blue-500/15 font-medium text-blue-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function IconButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30">
      {children}
    </button>
  );
}

export default function AnnotationPanel(props: {
  attachment: AnnotationAttachment;
  lessonId?: string | null;
  subjectSlug?: string | null;
  storageKey?: string;
}) {
  return (
    <AnnotationErrorBoundary>
      <AnnotationPanelInner {...props} />
    </AnnotationErrorBoundary>
  );
}
