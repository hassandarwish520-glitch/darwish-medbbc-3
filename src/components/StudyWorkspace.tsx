"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookmarkButton from "@/components/BookmarkButton";
import LessonViewer from "@/components/LessonViewer";
import { getOfflinePackage, upsertOfflinePackage, type OfflinePackageAsset } from "@/lib/offline-downloads";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Eraser,
  Expand,
  FileText,
  Gauge,
  HardDriveDownload,
  Highlighter,
  Library,
  ListOrdered,
  Lock,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PencilLine,
  PictureInPicture2,
  PlaySquare,
  Redo2,
  RefreshCw,
  Save,
  Send,
  SplitSquareVertical,
  TimerReset,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

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
type TelegramLink = { label: string; url: string; resolution?: string | null; size?: string | null };
type MaterialItem = { label: string; url: string; kind: string; mime?: string | null };
type PlaylistItem = { id: string; title: string; active: boolean };
type VideoType = "youtube" | "vimeo" | "direct" | "none";
type StoredProgress = {
  position: number;
  duration: number;
  watchedSeconds: number;
  updatedAt: string;
  completed: boolean;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatTime(totalSeconds: number) {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes?: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStorageGet(key: string) {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    // ignore restricted-browser storage failures
  }
}

function isHtmlAttachment(attachment: NonNullable<Attachment>) {
  const lower = attachment.name.toLowerCase();
  return attachment.mime.includes("html") || lower.endsWith(".html") || lower.endsWith(".htm");
}

function isImageMaterial(item: MaterialItem) {
  const lower = item.label.toLowerCase();
  return item.kind.toLowerCase().includes("image") || item.mime?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(lower);
}

class AttachmentErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div className="overflow-hidden rounded-[28px] border border-ink-800 bg-ink-950/90 p-8 text-center">
          <div className="text-sm text-red-400">The attachment viewer encountered an error. Please refresh to try again.</div>
          <button
            type="button"
            className="mt-4 rounded-xl border border-ink-700 bg-ink-900/80 px-4 py-2 text-sm text-slate-300"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AttachmentPanel({ attachment, lessonId, subjectSlug }: { attachment: NonNullable<Attachment>; lessonId: string; subjectSlug?: string | null }) {
  type AnnotationTool = "pen" | "highlighter" | "eraser";
  type AnnotationStroke = {
    tool: AnnotationTool;
    color: string;
    size: number;
    points: { x: number; y: number }[];
  };

  const isPdf = attachment.mime === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
  const isImage = attachment.mime.startsWith("image/");
  const isHtml = isHtmlAttachment(attachment);
  const [htmlSource, setHtmlSource] = useState("");
  const [loadingHtml, setLoadingHtml] = useState(isHtml);
  const [failedHtml, setFailedHtml] = useState(false);
  const [tool, setTool] = useState<AnnotationTool>("highlighter");
  const [annotationColor, setAnnotationColor] = useState("#fde047");
  const [annotationSize, setAnnotationSize] = useState(4);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationStroke[]>([]);
  const [annotationEntryId, setAnnotationEntryId] = useState<string | null>(null);
  const [annotationReady, setAnnotationReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<AnnotationStroke | null>(null);
  const saveAnnotationsTimerRef = useRef<number | null>(null);
  const palette = ["#fde047", "#86efac", "#f9a8d4", "#60a5fa", "#a78bfa", "#fdba74"];

  const renderStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: AnnotationStroke) => {
    if (!stroke || !Array.isArray(stroke.points)) return;
    // Filter out any NaN/invalid points that can arrive from cancelled touch events on Android
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
        ctx.globalAlpha = 0.35;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = Math.max(2, stroke.size);
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.moveTo(validPoints[0].x, validPoints[0].y);
      validPoints.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
      ctx.restore();
    } catch {
      // Silently discard canvas errors for this stroke (e.g. invalid composite op on some Android WebViews)
      try { ctx.restore(); } catch { /* ignore */ }
    }
  }, []);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.forEach((stroke) => renderStroke(ctx, stroke));
    } catch {
      // Ignore canvas redraw errors — the overlay will be cleared on the next stroke
    }
  }, [renderStroke, strokes]);

  const resizeOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    try {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
      redrawOverlay();
    } catch {
      // Ignore resize errors (e.g. detached element during navigation on Android)
    }
  }, [redrawOverlay]);

  useEffect(() => {
    let active = true;
    setAnnotationReady(false);
    setAnnotationEntryId(null);

    fetch(`/api/medical-library?lesson_id=${encodeURIComponent(lessonId)}&entry_type=attachment&limit=100`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("annotation-load-failed");
        const payload = await response.json().catch(() => ({ entries: [] }));
        if (!active) return;
        const match = (Array.isArray(payload.entries) ? payload.entries : []).find((entry: LibraryEntry) => {
          const data = entry.data as Record<string, unknown> | null;
          return entry.entry_type === "attachment" && data?.kind === "annotation" && data?.attachment_href === attachment.href;
        }) as LibraryEntry | undefined;
        setAnnotationEntryId(match?.id ?? null);
        setStrokes(Array.isArray(match?.data?.strokes) ? (match?.data?.strokes as AnnotationStroke[]) : []);
        setRedoStack([]);
        setAnnotationReady(true);
      })
      .catch(() => {
        if (!active) return;
        setStrokes([]);
        setRedoStack([]);
        setAnnotationReady(true);
      });

    return () => {
      active = false;
    };
  }, [attachment.href, lessonId]);

  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay, strokes]);

  useEffect(() => {
    if (!annotationReady) return;
    if (saveAnnotationsTimerRef.current) window.clearTimeout(saveAnnotationsTimerRef.current);
    saveAnnotationsTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/medical-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: annotationEntryId ?? undefined,
            lesson_id: lessonId,
            subject_slug: subjectSlug || null,
            entry_type: "attachment",
            title: `${attachment.name} annotations`,
            color: annotationColor,
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
          setAnnotationEntryId(payload.entry.id);
        }
      } catch {
        // keep the current overlay even if saving fails
      }
    }, 450);

    return () => {
      if (saveAnnotationsTimerRef.current) window.clearTimeout(saveAnnotationsTimerRef.current);
    };
  }, [annotationColor, annotationEntryId, annotationReady, attachment.href, attachment.name, lessonId, strokes, subjectSlug]);

  useEffect(() => {
    resizeOverlay();
    window.addEventListener("resize", resizeOverlay);
    return () => window.removeEventListener("resize", resizeOverlay);
  }, [resizeOverlay]);

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

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const target = event.currentTarget;
    if (!target) return { x: 0, y: 0 };
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Guard against NaN from cancelled touch events on Android
    return { x: isFinite(x) ? x : 0, y: isFinite(y) ? y : 0 };
  }

  function startStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is no longer active (e.g. quick tap on mobile)
    }
    currentStrokeRef.current = {
      tool,
      color: annotationColor,
      size: annotationSize,
      points: [getPoint(event)],
    };
  }

  function drawStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push(getPoint(event));
    redrawOverlay();
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) renderStroke(ctx, currentStrokeRef.current);
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    if (currentStrokeRef.current.points.length > 1) {
      setStrokes((prev) => [...prev, currentStrokeRef.current as AnnotationStroke]);
      setRedoStack([]);
    }
    currentStrokeRef.current = null;
  }

  function undoAnnotation() {
    setStrokes((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const removed = next.pop() as AnnotationStroke;
      setRedoStack((redo) => [...redo, removed]);
      return next;
    });
  }

  function redoAnnotation() {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const restored = next.pop() as AnnotationStroke;
      setStrokes((current) => [...current, restored]);
      return next;
    });
  }

  function clearAnnotations() {
    setStrokes([]);
    setRedoStack([]);
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-800 bg-ink-950/90 shadow-[0_20px_70px_rgba(3,7,18,0.45)]">
      <div className="border-b border-ink-800 px-4 pt-3 md:px-5">
        <div className="flex items-center gap-6 text-sm">
          <button type="button" className="border-b-2 border-[#4f7cff] pb-2 font-medium text-[#78a6ff]">Attachment</button>
          <button type="button" className="border-b-2 border-transparent pb-2 text-slate-400">Details</button>
        </div>
      </div>

      <div className="border-b border-ink-800 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white md:text-lg">{attachment.name}</div>
            <div className="mt-1 text-xs text-slate-500">In-app secure attachment view</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink-700 bg-ink-900/80">−</button>
            <span className="rounded-xl border border-ink-700 bg-ink-900/80 px-3 py-1.5">100%</span>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink-700 bg-ink-900/80">+</button>
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink-700 bg-ink-900/80">
              <Expand className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-ink-800 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={tool === "pen" ? "subject-tab active" : "subject-tab"} onClick={() => setTool("pen")}>
            <PencilLine className="h-4 w-4" />
            <span>Pen</span>
          </button>
          <button type="button" className={tool === "highlighter" ? "subject-tab active" : "subject-tab"} onClick={() => setTool("highlighter")}>
            <Highlighter className="h-4 w-4" />
            <span>Highlight</span>
          </button>
          <button type="button" className={tool === "eraser" ? "subject-tab active" : "subject-tab"} onClick={() => setTool("eraser")}>
            <Eraser className="h-4 w-4" />
            <span>Eraser</span>
          </button>
          <button type="button" className="subject-tab" disabled={!strokes.length} onClick={undoAnnotation}>
            <Undo2 className="h-4 w-4" />
            <span>Undo</span>
          </button>
          <button type="button" className="subject-tab" disabled={!redoStack.length} onClick={redoAnnotation}>
            <Redo2 className="h-4 w-4" />
            <span>Redo</span>
          </button>
          <button type="button" className="subject-tab" onClick={clearAnnotations}>
            <MoreHorizontal className="h-4 w-4" />
            <span>Clear</span>
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {palette.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAnnotationColor(color)}
                className={`h-7 w-7 rounded-full border-2 transition ${annotationColor === color ? "scale-110 border-white" : "border-transparent"}`}
                style={{ backgroundColor: color }}
                aria-label={`Select ${color}`}
              />
            ))}
            <input type="range" min={2} max={12} value={annotationSize} onChange={(event) => setAnnotationSize(Number(event.target.value))} className="w-24 accent-brand" />
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-[640px] overflow-hidden bg-white" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        {isImage ? (
          <img src={attachment.href} alt={attachment.name} className="block h-full w-full object-contain" draggable={false} />
        ) : isPdf ? (
          <iframe
            src={`${attachment.href}#toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`}
            className="block h-[640px] w-full bg-white"
            title={attachment.name}
            sandbox="allow-same-origin allow-scripts"
          />
        ) : isHtml ? (
          loadingHtml ? (
            <div className="grid h-[640px] place-items-center px-6 text-center text-sm text-slate-500">Loading document…</div>
          ) : failedHtml ? (
            <div className="grid h-[640px] place-items-center px-6 text-center text-sm text-red-400">
              Unable to render this HTML document inside the workspace. Please try refreshing the page.
            </div>
          ) : (
            <iframe
              srcDoc={htmlSource}
              sandbox="allow-same-origin allow-scripts allow-forms"
              className="block h-[640px] w-full bg-white"
              title={attachment.name}
            />
          )
        ) : (
          <iframe src={attachment.href} className="block h-[640px] w-full bg-white" title={attachment.name} />
        )}

        <canvas
          ref={overlayRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={startStroke}
          onPointerMove={drawStroke}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
        <button type="button" className="absolute bottom-5 right-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-[0_10px_30px_rgba(79,124,255,0.45)]">
          <PencilLine className="h-5 w-5" />
        </button>
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
  sessionEmbedUrl,
  videoType,
  provider,
  telegramLinks,
  materials,
  playlist,
  playlistScopeKey,
}: {
  lessonId: string;
  lessonTitle: string;
  lessonKind: string;
  lessonMeta?: Record<string, unknown> | null;
  subjectSlug?: string | null;
  externalAttachment?: Attachment;
  sessionUrl?: string | null;
  sessionEmbedUrl?: string | null;
  videoType?: VideoType;
  provider?: string | null;
  telegramLinks?: TelegramLink[];
  materials?: MaterialItem[];
  playlist?: PlaylistItem[];
  playlistScopeKey?: string;
}) {
  const [viewMode, setViewMode] = useState<"split" | "focus">("split");
  const [panel, setPanel] = useState<PanelKey>("notes");
  const [workspaceVisible, setWorkspaceVisible] = useState(true);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [noteTitle, setNoteTitle] = useState(lessonTitle);
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushSize, setBrushSize] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [pipActive, setPipActive] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [storedProgress, setStoredProgress] = useState<StoredProgress | null>(null);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const [offlineCachedCount, setOfflineCachedCount] = useState(0);
  const [offlinePackageState, setOfflinePackageState] = useState<"ready" | "partial" | "queued" | null>(null);
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const [noteTimestamp, setNoteTimestamp] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawingRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const viewerSectionRef = useRef<HTMLDivElement | null>(null);

  const isVideoLesson = lessonKind === "video";
  const effectiveVideoType: VideoType = videoType ?? "none";
  const canControlVideo = isVideoLesson && effectiveVideoType === "direct";
  const scopedPlaylist = playlist ?? [];
  const playlistScope = playlistScopeKey ?? lessonId;
  const progressStorageKey = `lesson-video-progress:${lessonId}`;
  const completionStorageKey = `lesson-playlist-completion:${playlistScope}`;
  const autoNextStorageKey = `lesson-video-autonext:${playlistScope}`;
  const activeIndex = scopedPlaylist.findIndex((item) => item.active);
  const nextLecture = activeIndex >= 0 ? scopedPlaylist[activeIndex + 1] ?? null : null;

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

  useEffect(() => {
    const completionState = safeParse<Record<string, boolean>>(safeStorageGet(completionStorageKey)) ?? {};
    setCompletionMap(completionState);
    const savedProgressState = safeParse<StoredProgress>(safeStorageGet(progressStorageKey));
    if (savedProgressState) {
      setStoredProgress(savedProgressState);
      setCurrentTime(savedProgressState.position || 0);
      setDuration(savedProgressState.duration || 0);
    }

    const savedOfflinePackage = getOfflinePackage(lessonId);
    setOfflineQueued(Boolean(savedOfflinePackage));
    setOfflineCachedCount(savedOfflinePackage?.cachedAssetIds.length ?? 0);
    setOfflinePackageState(savedOfflinePackage?.status ?? null);
    setAutoNext(safeStorageGet(autoNextStorageKey) === "1");
  }, [autoNextStorageKey, completionStorageKey, lessonId, progressStorageKey]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 3200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!canControlVideo || !videoRef.current) return;
    videoRef.current.playbackRate = speed;
  }, [canControlVideo, speed]);

  const writeCompletionMap = useCallback((nextMap: Record<string, boolean>) => {
    setCompletionMap(nextMap);
    safeStorageSet(completionStorageKey, JSON.stringify(nextMap));
  }, [completionStorageKey]);

  const persistProgress = useCallback((position: number, totalDuration: number) => {
    const completed = totalDuration > 0 ? position / totalDuration >= 0.95 : false;
    const nextState: StoredProgress = {
      position,
      duration: totalDuration,
      watchedSeconds: Math.max(storedProgress?.watchedSeconds ?? 0, position),
      updatedAt: new Date().toISOString(),
      completed,
    };
    setStoredProgress(nextState);
    safeStorageSet(progressStorageKey, JSON.stringify(nextState));
    if (completed) {
      writeCompletionMap({ ...completionMap, [lessonId]: true });
    }
  }, [completionMap, lessonId, progressStorageKey, storedProgress?.watchedSeconds, writeCompletionMap]);

  const highlights = useMemo(() => entries.filter((item) => item.entry_type === "highlight"), [entries]);
  const notes = useMemo(() => entries.filter((item) => item.entry_type === "note"), [entries]);
  const canvases = useMemo(() => entries.filter((item) => item.entry_type === "canvas"), [entries]);
  const noteCount = notes.length;
  const completedCount = useMemo(() => scopedPlaylist.filter((item) => completionMap[item.id]).length, [scopedPlaylist, completionMap]);
  const remainingCount = Math.max(scopedPlaylist.length - completedCount, 0);
  const currentLessonCompleted = Boolean(completionMap[lessonId] || storedProgress?.completed);
  const courseProgressPct = scopedPlaylist.length ? Math.round((completedCount / scopedPlaylist.length) * 100) : currentLessonCompleted ? 100 : Math.min(100, Math.round((currentTime / Math.max(duration || 1, 1)) * 100));
  const lessonCompletionPct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : currentLessonCompleted ? 100 : 0;
  const watchTimeLabel = formatTime(storedProgress?.watchedSeconds ?? currentTime);
  const totalMaterialItems = useMemo(() => {
    const items = [...(materials ?? [])];
    if (externalAttachment && !items.some((item) => item.url === externalAttachment.href)) {
      items.unshift({ label: externalAttachment.name, url: externalAttachment.href, kind: "Attached Study File", mime: externalAttachment.mime });
    }
    return items;
  }, [externalAttachment, materials]);
  const offlineAssets = useMemo<OfflinePackageAsset[]>(() => {
    const assets = totalMaterialItems.map((item, index) => ({
      id: `material:${index}:${item.label}`,
      url: item.url,
      label: item.label,
      kind: item.kind,
      mime: item.mime ?? null,
      cacheable: item.url.startsWith("/"),
    }));

    if (canControlVideo && sessionEmbedUrl) {
      assets.unshift({
        id: "video:primary",
        url: sessionEmbedUrl,
        label: `${lessonTitle} video`,
        kind: "Video",
        mime: "video/*",
        cacheable: sessionEmbedUrl.startsWith("/"),
      });
    }

    return assets;
  }, [canControlVideo, lessonTitle, sessionEmbedUrl, totalMaterialItems]);
  const offlineCacheableCount = offlineAssets.filter((asset) => asset.cacheable).length;
  const effectiveTelegramLinks = telegramLinks ?? [];
  const showAttachmentInsideWorkspace = Boolean(externalAttachment && viewMode === "split");
  const immersiveMode = viewMode === "focus" || isFullscreen;

  async function saveEntry(payload: {
    id?: string;
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
          id: payload.id,
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
      id: editingNoteId ?? undefined,
      entry_type: "note",
      title: noteTitle.trim() || lessonTitle,
      body: noteBody.trim(),
      color: "#93c5fd",
      data: {
        source: lessonKind,
        timestamp: Math.floor(currentTime),
        timeLabel: formatTime(currentTime),
      },
    });
    setEditingNoteId(null);
    setNoteBody("");
    setNoteTitle(lessonTitle);
    setNoteTimestamp(currentTime);
    setStatus("Note saved");
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
    setStatus("Whiteboard saved");
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/medical-library?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadWorkspace();
    if (editingNoteId === id) {
      setEditingNoteId(null);
      setNoteBody("");
      setNoteTitle(lessonTitle);
    }
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

  async function togglePiP() {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setPipActive(true);
      }
    } catch {
      setStatus("Picture-in-Picture is not available in this browser.");
    }
  }

  function jumpToTimestamp(seconds: number) {
    if (!videoRef.current || !canControlVideo) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    setStatus(`Jumped to ${formatTime(seconds)}`);
  }

  async function copyTimestamp() {
    const label = formatTime(currentTime);
    try {
      await navigator.clipboard.writeText(label);
      setStatus(`Timestamp copied: ${label}`);
    } catch {
      setStatus(label);
    }
  }

  async function toggleOfflineQueue() {
    setOfflineSyncing(true);
    try {
      const nextPackage = await upsertOfflinePackage({
        lessonId,
        lessonTitle,
        provider,
        assets: offlineAssets,
        notesCount: noteCount,
        progress: {
          position: Math.floor(currentTime),
          duration: Math.floor(duration),
          watchedSeconds: Math.floor(storedProgress?.watchedSeconds ?? currentTime),
          completed: currentLessonCompleted,
        },
        warnings: [
          effectiveVideoType !== "direct" ? "External Telegram or YouTube streams remain provider-controlled in the current web build." : "",
          offlineCacheableCount === 0 ? "The lecture package is registered for in-app access, but no cacheable internal file was exposed from this lesson page." : "",
        ],
      });
      setOfflineQueued(true);
      setOfflineCachedCount(nextPackage.cachedAssetIds.length);
      setOfflinePackageState(nextPackage.status);
      setStatus(nextPackage.status === "ready" ? "Lecture package added to Downloads" : "Lecture package saved for in-app Downloads");
    } catch {
      setStatus("Could not prepare the lecture package right now.");
    } finally {
      setOfflineSyncing(false);
    }
  }

  function toggleCompleted() {
    const nextMap = { ...completionMap, [lessonId]: !currentLessonCompleted };
    writeCompletionMap(nextMap);
    setStatus(nextMap[lessonId] ? "Lecture marked as completed" : "Lecture marked as pending");
  }

  function editNote(entry: LibraryEntry) {
    setWorkspaceVisible(true);
    setPanel("notes");
    setEditingNoteId(entry.id);
    setNoteTitle(entry.title || lessonTitle);
    setNoteBody(entry.body || "");
    const ts = typeof entry.data?.timestamp === "number" ? entry.data.timestamp : 0;
    setNoteTimestamp(ts);
    viewerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const nextDuration = videoRef.current.duration || 0;
    setDuration(nextDuration);
    videoRef.current.playbackRate = speed;
    if (storedProgress?.position && storedProgress.position > 5 && storedProgress.position < nextDuration - 5) {
      videoRef.current.currentTime = storedProgress.position;
      setCurrentTime(storedProgress.position);
    }
  }, [speed, storedProgress?.position]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const position = videoRef.current.currentTime || 0;
    const totalDuration = videoRef.current.duration || duration || 0;
    setCurrentTime(position);
    setDuration(totalDuration);
    persistProgress(position, totalDuration);
  }, [duration, persistProgress]);

  const handleVideoEnded = useCallback(() => {
    setPipActive(false);
    writeCompletionMap({ ...completionMap, [lessonId]: true });
    if (autoNext && nextLecture) {
      window.location.href = `/lesson/${nextLecture.id}`;
    }
  }, [autoNext, completionMap, lessonId, nextLecture, writeCompletionMap]);

  return (
    <div
      ref={workspaceRef}
      className={immersiveMode ? "fixed inset-0 z-[90] overflow-auto bg-[#050b14] pt-[calc(env(safe-area-inset-top)+0.65rem)] md:pt-4" : "card overflow-hidden border border-ink-800 bg-[#07101b]"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3 md:px-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white md:text-base">{lessonTitle}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button type="button" className="subject-tab" onClick={toggleCompleted}>
            <CheckCircle2 className="h-4 w-4" />
            <span>{currentLessonCompleted ? "Completed" : "Mark complete"}</span>
          </button>
          <button type="button" className="subject-tab" onClick={() => void copyTimestamp()}>
            <Copy className="h-4 w-4" />
            <span>Copy timestamp</span>
          </button>
          <button type="button" className="subject-tab" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {status ? (
        <div className="border-b border-ink-800 bg-brand/10 px-4 py-2 text-sm text-emerald-200">{status}</div>
      ) : null}

      <div className={`grid gap-3 p-3 md:p-4 ${viewMode === "split" ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
        <div className="space-y-3">
          {isVideoLesson ? (
            <section className="overflow-hidden rounded-[24px] border border-ink-800 bg-[#08111d] shadow-[0_20px_70px_rgba(3,7,18,0.45)]">
              <div className="overflow-hidden rounded-[20px] border-b border-ink-800 bg-black">
                <div className="aspect-video w-full bg-black">
                  {sessionEmbedUrl && effectiveVideoType !== "none" ? (
                    canControlVideo ? (
                      <video
                        ref={videoRef}
                        src={sessionEmbedUrl}
                        controls
                        playsInline
                        className="h-full w-full"
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleVideoEnded}
                      />
                    ) : (
                      <iframe
                        src={sessionEmbedUrl}
                        className="h-full w-full border-0"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        title={lessonTitle}
                      />
                    )
                  ) : (
                    <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500">
                      No playable video source is attached to this lesson yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 px-3 pb-3 pt-2">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80 text-slate-300" disabled>
                    <PlaySquare className="h-3.5 w-3.5" />
                  </button>
                  <span>{formatTime(currentTime)} / {duration ? formatTime(duration) : "00:00"}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-[#4f7cff] transition-all" style={{ width: `${lessonCompletionPct}%` }} />
                  </div>
                  <button type="button" className="rounded-full border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300" onClick={() => setSpeed((value) => {
                    const index = SPEEDS.indexOf(value);
                    return SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
                  })}>
                    {speed}x
                  </button>
                  <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80 text-slate-300" disabled={!canControlVideo} onClick={() => void togglePiP()}>
                    <Expand className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-hidden rounded-[22px] border border-ink-800 bg-[#07101a]">
                  <div className="flex items-center gap-2 border-b border-ink-800 px-3 pt-2">
                    {[
                      { key: "notes", label: "Notes" },
                      { key: "whiteboard", label: "Whiteboard" },
                      { key: "library", label: "Library" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`border-b-2 px-3 py-2 text-sm transition ${panel === item.key ? "border-[#4f7cff] text-[#78a6ff]" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                        onClick={() => {
                          setWorkspaceVisible(true);
                          setPanel(item.key as PanelKey);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                    <div className="ml-auto">
                      <button type="button" className="subject-tab text-xs" onClick={() => setWorkspaceVisible((value) => !value)}>
                        <span>{workspaceVisible ? "Hide" : "Show"}</span>
                      </button>
                    </div>
                  </div>

                  {workspaceVisible ? (
                    <div className="p-3">
                      {panel === "notes" ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-slate-300">
                            <button type="button" className="subject-tab px-2 text-xs" onClick={() => setNoteBody((value) => `${value}
• `)}>↶</button>
                            <button type="button" className="subject-tab px-2 text-xs" onClick={() => setNoteBody((value) => `${value}
`)}>↷</button>
                            <button type="button" className="subject-tab px-2 text-xs font-bold" onClick={() => setNoteBody((value) => `${value}**bold**`)}>B</button>
                            <button type="button" className="subject-tab px-2 text-xs italic" onClick={() => setNoteBody((value) => `${value}_italic_`)}>I</button>
                            <button type="button" className="subject-tab px-2 text-xs underline" onClick={() => setNoteBody((value) => `${value}__underline__`)}>U</button>
                            <button type="button" className="subject-tab px-2 text-xs" onClick={() => setNoteBody((value) => `${value}
• `)}>•</button>
                            <button type="button" className="subject-tab px-2 text-xs" onClick={() => setNoteBody((value) => `${value}
1. `)}>1.</button>
                            <button type="button" className="subject-tab px-2 text-xs" onClick={() => setNoteTimestamp(currentTime)}>⏱</button>
                            <div className="ml-auto flex items-center gap-2">
                              {["#fde047", "#86efac", "#f9a8d4"].map((color) => (
                                <button key={color} type="button" className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} />
                              ))}
                              <button type="button" className="subject-tab px-2 text-xs">⋮</button>
                            </div>
                          </div>

                          <input
                            className="input border-ink-700 bg-[#08111d] text-white placeholder:text-slate-500"
                            value={noteTitle}
                            onChange={(event) => setNoteTitle(event.target.value)}
                            placeholder="Note title"
                          />

                          <textarea
                            className="min-h-[340px] w-full rounded-[18px] border border-ink-800 bg-[#08111d] px-4 py-4 text-sm leading-8 text-slate-200 outline-none placeholder:text-slate-500"
                            value={noteBody}
                            onChange={(event) => setNoteBody(event.target.value)}
                            placeholder="Psoriasis – key points

• Chronic immune-mediated inflammatory disease."
                          />

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">Saved {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                            <button type="button" className="btn-primary text-sm" disabled={saving || !noteBody.trim()} onClick={() => void saveNote()}>
                              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save note"}
                            </button>
                          </div>
                        </div>
                      ) : panel === "whiteboard" ? (
                        <div className="space-y-3">
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
                          <div className="rounded-[22px] border border-ink-800 bg-slate-100 p-3">
                            <canvas
                              ref={canvasRef}
                              className="study-canvas block w-full rounded-[18px] bg-white"
                              onPointerDown={startDrawing}
                              onPointerMove={draw}
                              onPointerUp={stopDrawing}
                              onPointerLeave={stopDrawing}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
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
                          <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
                            {entries.slice(0, 8).map((entry) => (
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
                                {entry.body ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{entry.body}</div> : null}
                              </div>
                            ))}
                            {!entries.length && !loading ? <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5 text-sm text-slate-500">No saved items yet for this lesson.</div> : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-[24px] border border-ink-800 bg-[#08111d] p-4">
              <LessonViewer id={lessonId} kind={lessonKind} fileType={typeof lessonMeta?.file_type === "string" ? lessonMeta.file_type : undefined} />
            </section>
          )}
        </div>

        <div className={`${viewMode === "focus" ? "hidden" : "block"} min-w-0`}>
          {showAttachmentInsideWorkspace && externalAttachment ? (
            <AttachmentErrorBoundary>
              <AttachmentPanel attachment={externalAttachment} lessonId={lessonId} subjectSlug={subjectSlug} />
            </AttachmentErrorBoundary>
          ) : (
            <section className="overflow-hidden rounded-[24px] border border-ink-800 bg-[#08111d] p-5 text-sm text-slate-400">
              No attachment is linked to this lesson.
            </section>
          )}
        </div>
      </div>

      <div className="border-t border-ink-800 px-3 pb-3 pt-1 md:px-4 md:pb-4">
        <section className="rounded-[22px] border border-ink-800 bg-[#07101a] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lecture Materials</div>
          <div className="mt-3 space-y-2">
            {totalMaterialItems.length ? totalMaterialItems.slice(0, 1).map((item) => (
              <div key={`${item.label}-${item.url}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-ink-800 bg-[#08111d] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.mime?.includes("pdf") ? "PDF" : item.kind}{item.mime?.includes("pdf") ? "" : item.mime ? ` • ${item.mime}` : ""}</div>
                </div>
                <button type="button" className="btn-primary text-sm" disabled={offlineSyncing} onClick={() => void toggleOfflineQueue()}>
                  <HardDriveDownload className="h-4 w-4" /> {offlineSyncing ? "Preparing…" : "Add to downloads"}
                </button>
              </div>
            )) : (
              <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-5 text-sm text-slate-500">No lecture materials are attached yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
