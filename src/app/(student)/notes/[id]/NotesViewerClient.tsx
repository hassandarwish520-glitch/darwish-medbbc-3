"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronLeft,
  Download,
  Expand,
  FileText,
  Highlighter,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Pin,
  Search,
  Share2,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Lesson = { id: string; title: string; kind: string; documentName: string; courseTitle?: string | null };
type Sibling = { id: string; title: string; kind: string };
type NoteItem = { id: string; text: string; createdAt: string; page: number };
type BookmarkItem = { id: string; page: number; label: string };
type RecentItem = { id: string; title: string; documentName: string; visitedAt: string };
type OutlineItem = { title: string; page: number; level: number };
type SearchResult = { page: number; excerpt: string; matchCount: number };

type StoredViewerState = {
  page: number;
  zoom: number;
  darkPdf: boolean;
  readingMode: boolean;
  bookmarks: BookmarkItem[];
  notes: NoteItem[];
};

const FALLBACK_OUTLINE: OutlineItem[] = [
  { title: "Introduction", page: 1, level: 0 },
  { title: "Hematopoiesis", page: 2, level: 0 },
  { title: "Anemias", page: 4, level: 0 },
  { title: "Microcytic", page: 5, level: 1 },
  { title: "Normocytic", page: 8, level: 1 },
  { title: "Macrocytic", page: 11, level: 1 },
  { title: "Leukemia", page: 14, level: 0 },
  { title: "Lymphoma", page: 18, level: 0 },
];

const shellButton =
  "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-[#4f7cff]/40 hover:bg-white/10";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prettyTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotesViewerClient({
  lesson,
  pdfUrl,
  siblings,
}: {
  lesson: Lesson;
  pdfUrl: string | null;
  siblings: Sibling[];
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewerShellRef = useRef<HTMLDivElement | null>(null);
  const chromeTimerRef = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"notes" | "bookmarks" | "search">("notes");
  const [darkPdf, setDarkPdf] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [penMode, setPenMode] = useState(false);
  const [zoom, setZoom] = useState(120);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>(FALLBACK_OUTLINE);
  const [searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
  const [viewerWidth, setViewerWidth] = useState(900);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [recentNotes, setRecentNotes] = useState<RecentItem[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const storageKey = `notes-viewer:${lesson.id}`;
  const recentStorageKey = "notes-viewer:recent";

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    if (readingMode || isFullscreen) {
      chromeTimerRef.current = window.setTimeout(() => setChromeVisible(false), 2600);
    }
  }, [isFullscreen, readingMode]);

  const closeChromeTimer = useCallback(() => {
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = null;
    }
  }, []);

  const activeBookmark = useMemo(() => bookmarks.find((bookmark) => bookmark.page === currentPage), [bookmarks, currentPage]);

  const progress = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0;
  const effectiveOutline = outlineItems.length ? outlineItems : FALLBACK_OUTLINE;
  const filteredOutline = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return effectiveOutline;
    return effectiveOutline.filter((item) => item.title.toLowerCase().includes(query));
  }, [effectiveOutline, searchQuery]);

  const pageWidth = useMemo(() => {
    const shellWidth = clamp(viewerWidth - (readingMode ? 32 : 72), 280, 1600);
    const widthByZoom = Math.round(shellWidth * (zoom / 120));
    return clamp(widthByZoom, 260, readingMode ? 1480 : 1180);
  }, [readingMode, viewerWidth, zoom]);

  useEffect(() => {
    const syncSize = () => setViewerWidth(viewerShellRef.current?.clientWidth ?? 900);
    syncSize();
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(syncSize)
      : null;
    if (observer && viewerShellRef.current) observer.observe(viewerShellRef.current);
    window.addEventListener("resize", syncSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StoredViewerState>;
      if (typeof parsed.page === "number") setCurrentPage(parsed.page);
      if (typeof parsed.zoom === "number") setZoom(clamp(parsed.zoom, 60, 400));
      if (typeof parsed.darkPdf === "boolean") setDarkPdf(parsed.darkPdf);
      if (typeof parsed.readingMode === "boolean") setReadingMode(parsed.readingMode);
      if (Array.isArray(parsed.bookmarks)) setBookmarks(parsed.bookmarks);
      if (Array.isArray(parsed.notes)) setNotes(parsed.notes);
    } catch {
      // ignore invalid persisted state
    }

    try {
      const rawRecent = window.localStorage.getItem(recentStorageKey);
      if (!rawRecent) return;
      const parsedRecent = JSON.parse(rawRecent) as RecentItem[];
      setRecentNotes(Array.isArray(parsedRecent) ? parsedRecent : []);
    } catch {
      // ignore invalid recent notes
    }
  }, [recentStorageKey, storageKey]);

  useEffect(() => {
    const payload: StoredViewerState = {
      page: currentPage,
      zoom,
      darkPdf,
      readingMode,
      bookmarks,
      notes,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [bookmarks, currentPage, darkPdf, notes, readingMode, storageKey, zoom]);

  useEffect(() => {
    const nextRecent: RecentItem[] = [
      {
        id: lesson.id,
        title: lesson.title,
        documentName: lesson.documentName,
        visitedAt: new Date().toISOString(),
      },
      ...recentNotes.filter((item) => item.id !== lesson.id),
    ].slice(0, 6);
    setRecentNotes(nextRecent);
    window.localStorage.setItem(recentStorageKey, JSON.stringify(nextRecent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    revealChrome();
    return closeChromeTimer;
  }, [closeChromeTimer, revealChrome]);

  useEffect(() => {
    if (numPages > 0) {
      setCurrentPage((value) => clamp(value, 1, numPages));
    }
  }, [numPages]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (event.key === "ArrowLeft") setCurrentPage((page) => clamp(page - 1, 1, Math.max(1, numPages || 9999)));
      if (event.key === "ArrowRight") setCurrentPage((page) => clamp(page + 1, 1, Math.max(1, numPages || 9999)));
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      }
      if ((event.key === "+" || event.key === "=") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setZoom((value) => clamp(value + 10, 60, 400));
      }
      if (event.key === "-" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setZoom((value) => clamp(value - 10, 60, 400));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numPages]);

  useEffect(() => {
    if (!pdfDoc) return;
    const doc = pdfDoc;
    let cancelled = false;

    async function buildOutline() {
      try {
        const outline = await doc.getOutline();
        if (!outline?.length) {
          if (!cancelled) setOutlineItems(FALLBACK_OUTLINE);
          return;
        }

        const nextItems: OutlineItem[] = [];
        const walk = async (items: any[], level: number) => {
          for (const item of items) {
            let page = 1;
            try {
              const resolvedDest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
              if (Array.isArray(resolvedDest) && resolvedDest[0]) {
                const pageIndex = await doc.getPageIndex(resolvedDest[0]);
                page = pageIndex + 1;
              }
            } catch {
              page = 1;
            }
            nextItems.push({ title: item.title || `Page ${page}`, page, level });
            if (Array.isArray(item.items) && item.items.length) {
              await walk(item.items, level + 1);
            }
          }
        };

        await walk(outline as any[], 0);
        if (!cancelled && nextItems.length) setOutlineItems(nextItems);
      } catch {
        if (!cancelled) setOutlineItems(FALLBACK_OUTLINE);
      }
    }

    async function buildSearchIndex() {
      try {
        const pages: SearchResult[] = [];
        for (let page = 1; page <= doc.numPages; page += 1) {
          const pdfPage = await doc.getPage(page);
          const textContent = await pdfPage.getTextContent();
          const text = textContent.items
            .map((item: any) => (typeof item.str === "string" ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          pages.push({ page, excerpt: text, matchCount: 0 });
          if (cancelled) return;
        }
        if (!cancelled) setSearchIndex(pages);
      } catch {
        if (!cancelled) setSearchIndex([]);
      }
    }

    void buildOutline();
    void buildSearchIndex();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [] as SearchResult[];

    return searchIndex
      .map((item) => {
        const haystack = item.excerpt.toLowerCase();
        const firstIndex = haystack.indexOf(query);
        if (firstIndex === -1) return null;
        const matchCount = haystack.split(query).length - 1;
        const start = Math.max(0, firstIndex - 60);
        const end = Math.min(item.excerpt.length, firstIndex + query.length + 90);
        const excerpt = `${start > 0 ? "…" : ""}${item.excerpt.slice(start, end)}${end < item.excerpt.length ? "…" : ""}`;
        return { page: item.page, excerpt, matchCount };
      })
      .filter(Boolean) as SearchResult[];
  }, [searchIndex, searchQuery]);

  const searchAwareTextRenderer = useCallback((textItem: { str: string }) => {
    const query = searchQuery.trim();
    if (!query) return textItem.str;
    const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    return textItem.str.replace(regex, `<mark style=\"background:rgba(251,191,36,0.45);color:inherit;border-radius:2px;padding:0 1px;\">$1</mark>`);
  }, [searchQuery]);

  const addNote = useCallback(() => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        text: newNote.trim(),
        createdAt: new Date().toISOString(),
        page: currentPage,
      },
      ...prev,
    ]);
    setNewNote("");
    setSaved(false);
    setRightTab("notes");
    setRightPanelOpen(true);
  }, [currentPage, newNote]);

  const deleteNote = useCallback((id: string) => setNotes((prev) => prev.filter((note) => note.id !== id)), []);

  const addBookmark = useCallback(() => {
    setBookmarks((prev) => {
      if (prev.some((bookmark) => bookmark.page === currentPage)) return prev;
      return [...prev, { id: crypto.randomUUID(), page: currentPage, label: `Page ${currentPage}` }].sort((a, b) => a.page - b.page);
    });
    setRightTab("bookmarks");
    setRightPanelOpen(true);
  }, [currentPage]);

  const toggleFullscreen = useCallback(async () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await rootRef.current.requestFullscreen().catch(() => undefined);
  }, []);

  const shareDocument = useCallback(async () => {
    try {
      const shareData = {
        title: lesson.documentName,
        text: `${lesson.courseTitle || lesson.title} — ${lesson.documentName}`,
        url: window.location.href,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopyStatus("Link copied");
        window.setTimeout(() => setCopyStatus(null), 1800);
      }
    } catch {
      // user cancelled share
    }
  }, [lesson.courseTitle, lesson.documentName, lesson.title]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(clamp(page, 1, Math.max(1, numPages || page)));
    revealChrome();
  }, [numPages, revealChrome]);

  const onWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 8 : -8;
    setZoom((value) => clamp(value + delta, 60, 400));
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#050b14] text-white"
      onMouseMove={revealChrome}
      onTouchStart={revealChrome}
    >
      <div className={`border-b border-white/10 bg-[#07111d]/95 backdrop-blur transition-all duration-300 ${readingMode && !chromeVisible ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-3 md:px-5">
          <Link href="/courses" className={shellButton}>
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {lesson.courseTitle || lesson.title}
            </div>
            <div className="truncate text-sm font-semibold text-white md:text-base">{lesson.documentName}</div>
          </div>
          <a href={pdfUrl ?? "#"} target="_blank" rel="noreferrer" className={shellButton}>
            <Download className="h-4 w-4" /> Download
          </a>
          <button type="button" onClick={shareDocument} className={shellButton}>
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button type="button" onClick={addBookmark} className={shellButton}>
            <Bookmark className={`h-4 w-4 ${activeBookmark ? "text-yellow-300" : ""}`} /> Bookmark
          </button>
          <button type="button" onClick={() => void toggleFullscreen()} className={shellButton}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
            {isFullscreen ? "Exit" : "Full Screen"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3 py-2 md:px-5">
          <button type="button" onClick={addBookmark} className={shellButton}>
            <Star className="h-4 w-4 text-yellow-300" /> Bookmark Page
          </button>
          <button
            type="button"
            onClick={() => { setHighlightMode((value) => !value); setPenMode(false); }}
            className={`${shellButton} ${highlightMode ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-200" : ""}`}
          >
            <Highlighter className="h-4 w-4" /> Highlight
          </button>
          <button
            type="button"
            onClick={() => { setPenMode((value) => !value); setHighlightMode(false); setRightPanelOpen(true); setRightTab("notes"); }}
            className={`${shellButton} ${penMode ? "border-sky-300/40 bg-sky-300/10 text-sky-200" : ""}`}
          >
            <PenLine className="h-4 w-4" /> Add Note
          </button>
          <button type="button" onClick={addBookmark} className={shellButton}>
            <Pin className="h-4 w-4 text-rose-300" /> Add Pin
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDarkPdf((value) => !value)} className={shellButton}>
              {darkPdf ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-violet-300" />}
              {darkPdf ? "Light" : "Dark Reading Mode"}
            </button>
            <button type="button" onClick={() => setReadingMode((value) => !value)} className={shellButton}>
              <Sparkles className="h-4 w-4 text-emerald-300" />
              {readingMode ? "Exit Reading" : "Reading Mode"}
            </button>
            <button type="button" onClick={() => setSidebarOpen((value) => !value)} className={shellButton}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />} Outline
            </button>
            <button type="button" onClick={() => setRightPanelOpen((value) => !value)} className={shellButton}>
              {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />} Panel
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!readingMode && sidebarOpen && (
          <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#08111d] lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Outline</div>
                <div className="mt-1 text-sm text-slate-200">Jump to any section</div>
              </div>
              <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
              <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                {filteredOutline.map((item, index) => (
                  <button
                    key={`${item.title}-${index}`}
                    type="button"
                    onClick={() => goToPage(item.page)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 ${currentPage === item.page ? "bg-[#4f7cff]/15 text-white" : "text-slate-300"}`}
                    style={{ paddingLeft: `${12 + item.level * 16}px` }}
                  >
                    {item.level === 0 ? <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#78a6ff]" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />}
                    <span className="truncate text-xs">{item.title}</span>
                    <span className="ml-auto text-[10px] text-slate-500">p.{item.page}</span>
                  </button>
                ))}
              </div>

              {siblings.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Related lessons</div>
                  <div className="space-y-1.5">
                    {siblings.map((sibling) => (
                      <Link
                        key={sibling.id}
                        href={`/notes/${sibling.id}`}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition hover:bg-white/10 ${sibling.id === lesson.id ? "bg-[#4f7cff]/12 text-white" : "text-slate-300"}`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#78a6ff]" />
                        <span className="truncate">{sibling.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {recentNotes.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Recent Notes</div>
                  <div className="space-y-1.5">
                    {recentNotes.map((item) => (
                      <Link key={item.id} href={`/notes/${item.id}`} className="block rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10">
                        <div className="truncate font-medium text-slate-100">✓ {item.documentName}</div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">{prettyTime(item.visitedAt)}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#09111a]">
          <div ref={viewerShellRef} className="relative flex-1 overflow-auto px-3 py-4 md:px-6 md:py-6" onWheel={onWheelZoom}>
            <div className="mx-auto flex min-h-full w-full items-start justify-center">
              <div className={`w-full rounded-[28px] border border-white/10 bg-[#0d1624] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.32)] transition-all duration-300 md:p-5 ${readingMode ? "max-w-none" : "max-w-[1280px]"}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#07101c] px-4 py-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{lesson.kind}</span>
                    <span>{numPages ? `Page ${currentPage} / ${numPages}` : `Page ${currentPage}`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{zoom}% zoom</span>
                    {highlightMode && <span className="rounded-full border border-yellow-300/25 bg-yellow-300/10 px-2 py-1 text-yellow-200">Highlight active</span>}
                    {penMode && <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-1 text-sky-200">Note mode</span>}
                  </div>
                </div>

                <div className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#d7dde6] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-300 ${darkPdf ? "bg-[#9ca3af]" : ""}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_55%)]" />
                  <div className="relative mx-auto flex w-full justify-center">
                    {pdfUrl ? (
                      <div className={`overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.22)] transition-all duration-300 ${darkPdf ? "[filter:invert(1)_hue-rotate(180deg)]" : ""}`}>
                        <Document
                          file={pdfUrl}
                          loading={<div className="grid min-h-[70vh] place-items-center px-6 text-sm text-slate-500">Loading your note…</div>}
                          error={<div className="grid min-h-[70vh] place-items-center px-6 text-sm text-red-500">Unable to load this document.</div>}
                          onLoadSuccess={(doc) => {
                            setPdfDoc(doc);
                            setNumPages(doc.numPages);
                          }}
                        >
                          <Page
                            pageNumber={currentPage}
                            width={pageWidth}
                            renderAnnotationLayer
                            renderTextLayer
                            customTextRenderer={searchAwareTextRenderer}
                            className="transition-all duration-300"
                          />
                        </Document>
                      </div>
                    ) : (
                      <div className="grid min-h-[70vh] w-full place-items-center rounded-[22px] border border-dashed border-slate-300 bg-white text-slate-500">
                        No PDF attached to this lesson
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`border-t border-white/10 bg-[#07111d]/95 px-3 py-3 backdrop-blur transition-all duration-300 md:px-6 ${readingMode && !chromeVisible ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100"}`}>
            <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className={`${shellButton} disabled:cursor-not-allowed disabled:opacity-40`}>
                  <ArrowLeft className="h-4 w-4" /> السابق
                </button>
                <button type="button" onClick={() => setZoom((value) => clamp(value - 10, 60, 400))} className={shellButton}>Zoom -</button>
                <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">{zoom}%</span>
                <button type="button" onClick={() => setZoom((value) => clamp(value + 10, 60, 400))} className={shellButton}>Zoom +</button>
                <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={numPages > 0 && currentPage >= numPages} className={`${shellButton} disabled:cursor-not-allowed disabled:opacity-40`}>
                  التالي <ArrowRight className="h-4 w-4" />
                </button>
                <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
                  {numPages ? `Page ${currentPage} / ${numPages}` : `Page ${currentPage}`}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{numPages ? `Page ${currentPage} / ${numPages}` : `Page ${currentPage}`}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#4f7cff] via-[#6ea8ff] to-[#9ad5ff] transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </main>

        {!readingMode && rightPanelOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-white/10 bg-[#08111d] xl:flex xl:flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                {(["notes", "bookmarks", "search"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRightTab(tab)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${rightTab === tab ? "bg-[#4f7cff] text-white" : "text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}
                  >
                    {tab === "notes" ? "Notes" : tab === "bookmarks" ? "Bookmarks" : "Search"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setRightPanelOpen(false)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {rightTab === "notes" && (
                <div className="flex h-full flex-col gap-3">
                  <textarea
                    value={newNote}
                    onChange={(event) => setNewNote(event.target.value)}
                    onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") addNote(); }}
                    placeholder="Write a quick note…"
                    rows={5}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-500"
                  />
                  <button type="button" onClick={addNote} className="rounded-2xl bg-gradient-to-r from-[#4f7cff] to-[#7f7cff] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,124,255,0.28)]">
                    Save note for page {currentPage}
                  </button>
                  <div className="space-y-3 overflow-y-auto">
                    {notes.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No notes yet.</div>}
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <button type="button" onClick={() => goToPage(note.page)} className="text-xs font-semibold text-[#78a6ff]">Page {note.page}</button>
                          <button type="button" onClick={() => deleteNote(note.id)} className="text-xs text-rose-300">Delete</button>
                        </div>
                        <p className="text-sm leading-7 text-slate-200">{note.text}</p>
                        <div className="mt-3 text-[11px] text-slate-500">{prettyTime(note.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                  {notes.length > 0 && (
                    <button type="button" onClick={() => setSaved(true)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-300">
                      {saved ? "Notes saved ✓" : "Save all notes"}
                    </button>
                  )}
                </div>
              )}

              {rightTab === "bookmarks" && (
                <div className="space-y-3">
                  {bookmarks.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No bookmarks yet.</div>}
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <button type="button" onClick={() => goToPage(bookmark.page)} className="text-left">
                        <div className="text-sm font-semibold text-slate-100">{bookmark.label}</div>
                        <div className="text-[11px] text-slate-500">Jump directly</div>
                      </button>
                      <button type="button" onClick={() => setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id))} className="text-xs text-rose-300">Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {rightTab === "search" && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search inside note…"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
                    Search matches are highlighted on the rendered page when available.
                  </div>
                  <div className="space-y-2">
                    {searchQuery && searchResults.length === 0 && filteredOutline.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No results found.</div>
                    )}
                    {searchResults.map((result) => (
                      <button
                        key={`${result.page}-${result.excerpt.slice(0, 20)}`}
                        type="button"
                        onClick={() => goToPage(result.page)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-[#4f7cff]/35"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-100">Page {result.page}</span>
                          <span className="text-[11px] text-slate-500">{result.matchCount} matches</span>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-slate-300">{result.excerpt}</p>
                      </button>
                    ))}
                    {filteredOutline.map((item, index) => (
                      <button
                        key={`${item.title}-outline-${index}`}
                        type="button"
                        onClick={() => goToPage(item.page)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-[#4f7cff]/35"
                      >
                        <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">Outline • Page {item.page}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {copyStatus && <div className="absolute right-4 top-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{copyStatus}</div>}
    </div>
  );
}
