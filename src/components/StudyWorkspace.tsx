"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookmarkButton from "@/components/BookmarkButton";
import LessonViewer from "@/components/LessonViewer";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  Expand,
  ExternalLink,
  Gauge,
  HardDriveDownload,
  Highlighter,
  Library,
  ListOrdered,
  Lock,
  Maximize2,
  Minimize2,
  PencilLine,
  PictureInPicture2,
  PlaySquare,
  RefreshCw,
  Save,
  Send,
  Share2,
  SplitSquareVertical,
  TimerReset,
  Trash2,
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

function isHtmlAttachment(attachment: NonNullable<Attachment>) {
  const lower = attachment.name.toLowerCase();
  return attachment.mime.includes("html") || lower.endsWith(".html") || lower.endsWith(".htm");
}

function isImageMaterial(item: MaterialItem) {
  const lower = item.label.toLowerCase();
  return item.kind.toLowerCase().includes("image") || item.mime?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(lower);
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
    <div className="flex h-full min-h-[60vh] flex-col border-t border-ink-800 bg-[#08111d] lg:min-h-[72vh] xl:min-h-[84vh] xl:border-l xl:border-t-0">
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
            className="relative h-full min-h-[60vh] select-none lg:min-h-[72vh] xl:min-h-[84vh]"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <iframe
              src={`${attachment.href}#toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`}
              className="block h-full min-h-[60vh] w-full bg-white lg:min-h-[72vh] xl:min-h-[84vh]"
              title={attachment.name}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        ) : isHtml ? (
          loadingHtml ? (
            <div className="grid h-full min-h-[60vh] place-items-center px-6 text-center text-sm text-slate-500 lg:min-h-[72vh] xl:min-h-[84vh]">Loading document…</div>
          ) : failedHtml ? (
            <div className="grid h-full min-h-[60vh] place-items-center px-6 text-center text-sm text-red-400 lg:min-h-[72vh] xl:min-h-[84vh]">
              Unable to render this HTML document inside the workspace. Please try refreshing the page.
            </div>
          ) : (
            <iframe
              srcDoc={htmlSource}
              sandbox="allow-same-origin allow-scripts allow-forms"
              className="block h-full min-h-[60vh] w-full bg-white lg:min-h-[72vh] xl:min-h-[84vh]"
              title={attachment.name}
            />
          )
        ) : (
          <iframe src={attachment.href} className="block h-full min-h-[60vh] w-full bg-white lg:min-h-[72vh] xl:min-h-[84vh]" title={attachment.name} />
        )}
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
  const [storageEstimate, setStorageEstimate] = useState<{ used: number | null; quota: number | null }>({ used: null, quota: null });
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
  const offlineStorageKey = `lesson-video-offline:${lessonId}`;
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
    const completionState = safeParse<Record<string, boolean>>(localStorage.getItem(completionStorageKey)) ?? {};
    setCompletionMap(completionState);
    const savedProgressState = safeParse<StoredProgress>(localStorage.getItem(progressStorageKey));
    if (savedProgressState) {
      setStoredProgress(savedProgressState);
      setCurrentTime(savedProgressState.position || 0);
      setDuration(savedProgressState.duration || 0);
    }
    setOfflineQueued(localStorage.getItem(offlineStorageKey) === "1");
    setAutoNext(localStorage.getItem(autoNextStorageKey) === "1");

    let mounted = true;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then((estimate) => {
        if (!mounted) return;
        setStorageEstimate({ used: estimate.usage ?? null, quota: estimate.quota ?? null });
      }).catch(() => undefined);
    }

    return () => {
      mounted = false;
    };
  }, [autoNextStorageKey, completionStorageKey, offlineStorageKey, progressStorageKey]);

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
    localStorage.setItem(completionStorageKey, JSON.stringify(nextMap));
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
    localStorage.setItem(progressStorageKey, JSON.stringify(nextState));
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

  async function shareLecture() {
    const payload = {
      title: lessonTitle,
      text: `Study session: ${lessonTitle}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(payload.url);
      }
      setStatus("Lecture link shared");
    } catch {
      setStatus("Share cancelled");
    }
  }

  function toggleOfflineQueue() {
    const next = !offlineQueued;
    setOfflineQueued(next);
    localStorage.setItem(offlineStorageKey, next ? "1" : "0");
    setStatus(next ? "Lecture added to offline queue" : "Offline lecture removed");
  }

  function toggleCompleted() {
    const nextMap = { ...completionMap, [lessonId]: !currentLessonCompleted };
    writeCompletionMap(nextMap);
    setStatus(nextMap[lessonId] ? "Lecture marked as completed" : "Lecture marked as pending");
  }

  function editNote(entry: LibraryEntry) {
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
      className={immersiveMode ? "fixed inset-0 z-[90] overflow-auto bg-[#040a12] pt-[calc(env(safe-area-inset-top)+0.85rem)] md:pt-4" : "card overflow-hidden border-ink-800 bg-ink-950/70"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Study workspace</div>
          <div className="mt-1 text-sm text-slate-300">
            Cleaner video-first layout with the same study workflow, improved organization, and preserved actions.
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

      {status ? (
        <div className="border-b border-ink-800 bg-brand/10 px-4 py-2 text-sm text-emerald-200">{status}</div>
      ) : null}

      <div className={`grid gap-0 ${viewMode === "split" ? "xl:grid-cols-[minmax(0,1.45fr)_minmax(350px,0.95fr)]" : "grid-cols-1"}`}>
        <div className="min-w-0 border-b border-ink-800 xl:border-b-0 xl:border-r">
          <div className="space-y-4 p-4" ref={viewerSectionRef}>
            {isVideoLesson ? (
              <section className="overflow-hidden rounded-[28px] border border-ink-800 bg-ink-950/90 shadow-[0_20px_70px_rgba(3,7,18,0.45)]">
                <div className="border-b border-ink-800 px-4 py-4 md:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-ink-700 bg-ink-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">Video session</span>
                        {provider ? <span className="rounded-full border border-ink-700 bg-ink-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{provider}</span> : null}
                        {storedProgress?.position ? <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">Resume from {formatTime(storedProgress.position)}</span> : null}
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-white md:text-2xl">{lessonTitle}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        Larger responsive player, preserved external session flow, and better organization for downloads, notes, progress, and playlist.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sessionUrl ? (
                        <a href={sessionUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                          <ExternalLink className="h-4 w-4" /> Open external session
                        </a>
                      ) : null}
                      {externalAttachment ? (
                        <a href={externalAttachment.href} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
                          <Download className="h-4 w-4" /> File included below
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-4 md:px-5">
                  <div className="overflow-hidden rounded-[24px] border border-ink-800 bg-black">
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
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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

                  <div className="mt-4 flex flex-col gap-4 rounded-[24px] border border-ink-800 bg-ink-900/70 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-2"><Clipboard className="h-4 w-4 text-brand" /> {formatTime(currentTime)} current</span>
                        <span>{duration ? `${formatTime(duration)} total` : "Waiting for metadata"}</span>
                        <span>{watchTimeLabel} watch time</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="subject-tab" onClick={() => setAutoNext((value) => {
                          const next = !value;
                          localStorage.setItem(autoNextStorageKey, next ? "1" : "0");
                          return next;
                        })}>
                          <PlaySquare className="h-4 w-4" /> <span>{autoNext ? "Auto next on" : "Auto next off"}</span>
                        </button>
                        <button type="button" className="subject-tab" onClick={() => setPlaylistOpen((value) => !value)}>
                          <ListOrdered className="h-4 w-4" /> <span>{playlistOpen ? "Hide playlist" : "Show playlist"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-gradient-to-r from-brand via-cyan-400 to-fuchsia-500 transition-all" style={{ width: `${lessonCompletionPct}%` }} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap gap-2">
                        {SPEEDS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSpeed(value)}
                            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                            style={{
                              borderColor: speed === value ? "rgba(16,185,129,0.4)" : "rgba(71,85,105,0.6)",
                              background: speed === value ? "rgba(16,185,129,0.12)" : "rgba(15,23,42,0.8)",
                              color: speed === value ? "#6ee7b7" : "#cbd5e1",
                            }}
                          >
                            <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> {value}×</span>
                          </button>
                        ))}
                      </div>
                      <div className="ml-auto flex flex-wrap gap-2">
                        <button type="button" className="subject-tab" onClick={() => void copyTimestamp()}>
                          <Copy className="h-4 w-4" /> <span>Copy timestamp</span>
                        </button>
                        <button type="button" className="subject-tab" disabled={!canControlVideo} onClick={() => void togglePiP()}>
                          <PictureInPicture2 className="h-4 w-4" /> <span>PiP</span>
                        </button>
                      </div>
                    </div>

                    {!canControlVideo ? (
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs leading-6 text-cyan-100">
                        External providers keep their own native playback controls. The improved layout preserves that behavior without replacing the current session flow.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <LessonViewer id={lessonId} kind={lessonKind} fileType={typeof lessonMeta?.file_type === "string" ? lessonMeta.file_type : undefined} />
            )}

            {showAttachmentInsideWorkspace && externalAttachment ? <AttachmentPanel attachment={externalAttachment} /> : null}
          </div>
        </div>

        <aside className={`${viewMode === "focus" ? "hidden" : "block"} min-w-0 bg-[#08111d]`}>
          <div className="space-y-4 p-4">
            <section className="rounded-[24px] border border-ink-800 bg-ink-900/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Study tools</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2"><BookmarkButton lessonId={lessonId} /></div>
                <button type="button" className="subject-tab w-full justify-center" onClick={toggleCompleted}>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{currentLessonCompleted ? "Completed" : "Mark completed"}</span>
                </button>
                <button type="button" className="subject-tab w-full justify-center" onClick={() => setPanel("notes")}>
                  <PencilLine className="h-4 w-4" />
                  <span>Personal notes</span>
                </button>
                <button type="button" className="subject-tab w-full justify-center" onClick={() => void copyTimestamp()}>
                  <TimerReset className="h-4 w-4" />
                  <span>Copy timestamp</span>
                </button>
                <button type="button" className="subject-tab w-full justify-center" onClick={() => void shareLecture()}>
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              {[
                { label: "Course Progress", value: `${courseProgressPct}%`, hint: `${completedCount}/${scopedPlaylist.length || 1} complete` },
                { label: "Current Subject", value: `${courseProgressPct}%`, hint: provider ? provider.toUpperCase() : "Lesson" },
                { label: "Lecture Completion", value: `${lessonCompletionPct}%`, hint: storedProgress?.position ? `Resume ${formatTime(storedProgress.position)}` : "Auto tracked" },
                { label: "Watch Time", value: watchTimeLabel, hint: duration ? `${formatTime(duration)} total` : "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-ink-800 bg-ink-900/70 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-xl font-bold text-white">{item.value}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
                </div>
              ))}
            </section>

            {effectiveTelegramLinks.length ? (
              <section className="rounded-[24px] border border-ink-800 bg-ink-900/70 p-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-sky-500/10 p-2 text-sky-300"><Send className="h-4 w-4" /></div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Telegram Downloads</div>
                    <div className="mt-1 text-sm font-semibold text-white">Quality links preserved</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {effectiveTelegramLinks.map((link) => (
                    <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3 transition hover:border-sky-400/40">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300"><Send className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{link.resolution || link.label}</span>
                          {link.size ? <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">{link.size}</span> : null}
                        </div>
                        <div className="mt-1 text-xs break-all text-slate-500">{link.label}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[24px] border border-ink-800 bg-ink-900/70 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-amber-500/10 p-2 text-amber-300">{totalMaterialItems.some(isImageMaterial) ? <Library className="h-4 w-4" /> : <Download className="h-4 w-4" />}</div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lecture Materials</div>
                  <div className="mt-1 text-sm font-semibold text-white">Files, notes, and clinical images</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {totalMaterialItems.length ? totalMaterialItems.map((item) => (
                  <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3 transition hover:border-amber-400/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">{isImageMaterial(item) ? <Library className="h-4 w-4" /> : <Download className="h-4 w-4" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.kind}{item.mime ? ` • ${item.mime}` : ""}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </a>
                )) : (
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-5 text-sm text-slate-500">No lecture materials are attached yet.</div>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-ink-800 bg-ink-900/70 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-fuchsia-500/10 p-2 text-fuchsia-300"><HardDriveDownload className="h-4 w-4" /></div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Offline Mode</div>
                  <div className="mt-1 text-sm font-semibold text-white">App-only secure viewing</div>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-xs leading-6 text-fuchsia-100">
                <span className="inline-flex items-center gap-2 font-semibold"><Lock className="h-3.5 w-3.5" /> UI prepared without replacing current web behavior.</span>
                <div className="mt-2">Encrypted storage, subscription validation, and in-app-only playback need native app or backend support. This layout keeps the experience ready while preserving all current features.</div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storage used</div>
                  <div className="mt-2 text-lg font-bold text-white">{formatBytes(storageEstimate.used)}</div>
                </div>
                <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storage quota</div>
                  <div className="mt-2 text-lg font-bold text-white">{formatBytes(storageEstimate.quota)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="subject-tab" onClick={toggleOfflineQueue}>
                  <Download className="h-4 w-4" /> <span>{offlineQueued ? "Remove offline" : "Queue offline"}</span>
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-[24px] border border-ink-800 bg-ink-900/70">
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
                    Notes stay linked to this lesson. The video-first layout stays clean while your personal notes remain one tap away.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input className="input" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" />
                    <button type="button" className="subject-tab justify-center" onClick={() => setNoteTimestamp(currentTime)}>
                      <TimerReset className="h-4 w-4" /> <span>{formatTime(noteTimestamp || currentTime)}</span>
                    </button>
                  </div>
                  <textarea className="input min-h-[240px]" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write concise high-yield bullet notes here..." />
                  {saveError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {saveError}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">Notes remain saved in the medical library and can include the current lecture timestamp.</div>
                    <div className="flex flex-wrap gap-2">
                      {editingNoteId ? (
                        <button type="button" className="subject-tab" onClick={() => {
                          setEditingNoteId(null);
                          setNoteTitle(lessonTitle);
                          setNoteBody("");
                        }}>
                          <X className="h-4 w-4" /> <span>Cancel</span>
                        </button>
                      ) : null}
                      <button type="button" className="btn-primary text-sm" disabled={saving || !noteBody.trim()} onClick={() => void saveNote()}>
                        <Save className="h-4 w-4" /> {saving ? "Saving…" : editingNoteId ? "Update note" : "Save note"}
                      </button>
                    </div>
                  </div>
                  {noteCount ? (
                    <div className="space-y-3">
                      {notes.slice(0, 8).map((entry) => {
                        const timeLabel = typeof entry.data?.timeLabel === "string" ? entry.data.timeLabel : null;
                        const timestamp = typeof entry.data?.timestamp === "number" ? entry.data.timestamp : null;
                        return (
                          <div key={entry.id} className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-semibold text-white">{entry.title || "Quick note"}</div>
                                  {timeLabel ? (
                                    <button type="button" className="rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand disabled:opacity-50" disabled={!canControlVideo || timestamp === null} onClick={() => timestamp !== null && jumpToTimestamp(timestamp)}>
                                      {timeLabel}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{formatDate(entry.updated_at)}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" className="text-slate-500 transition hover:text-cyan-300" onClick={() => editNote(entry)}>
                                  <PencilLine className="h-4 w-4" />
                                </button>
                                <button type="button" className="text-slate-500 transition hover:text-red-300" onClick={() => void deleteEntry(entry.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{entry.body}</div>
                          </div>
                        );
                      })}
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
            </section>

            {playlistOpen ? (
              <section className="rounded-[24px] border border-ink-800 bg-ink-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Lecture Playlist</div>
                    <div className="mt-1 text-sm font-semibold text-white">Current, completed, remaining</div>
                  </div>
                  <div className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{scopedPlaylist.length}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-3 py-3">
                    <div className="text-lg font-bold text-white">{activeIndex >= 0 ? activeIndex + 1 : 1}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Current</div>
                  </div>
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-3 py-3">
                    <div className="text-lg font-bold text-white">{completedCount}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Completed</div>
                  </div>
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-3 py-3">
                    <div className="text-lg font-bold text-white">{remainingCount}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">Remaining</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {scopedPlaylist.length ? scopedPlaylist.map((item, index) => {
                    const done = Boolean(completionMap[item.id]);
                    return (
                      <a key={item.id} href={`/lesson/${item.id}`} className="flex items-start gap-3 rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3 transition hover:border-brand/30">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-300">
                          {done ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <PlaySquare className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Lecture {index + 1}</span>
                            {item.active ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Now playing</span> : null}
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm font-semibold text-white">{item.title}</div>
                        </div>
                      </a>
                    );
                  }) : (
                    <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-5 text-sm text-slate-500">No related video playlist was found for this lesson.</div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
