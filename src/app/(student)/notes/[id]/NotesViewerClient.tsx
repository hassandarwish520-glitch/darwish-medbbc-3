"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft, ZoomIn, ZoomOut, Highlighter, PenLine,
  Moon, Sun, Bookmark, Search, FileText, X, Menu,
  BookOpen, Plus, Trash2, List, Save, FileX,
} from "lucide-react";

type Lesson = { id: string; title: string; kind: string; documentName: string };
type Sibling = { id: string; title: string; kind: string };
type NoteItem = { id: string; text: string; createdAt: string };
type BookmarkItem = { id: string; page: number; label: string };

const OUTLINE = [
  { title: "Introduction", page: 1, level: 0 },
  { title: "Chapter 1: Overview", page: 3, level: 0 },
  { title: "1.1 Background", page: 3, level: 1 },
  { title: "1.2 Key Concepts", page: 5, level: 1 },
  { title: "Chapter 2: Core Topics", page: 8, level: 0 },
  { title: "2.1 Pathophysiology", page: 8, level: 1 },
  { title: "2.2 Clinical Features", page: 12, level: 1 },
  { title: "2.3 Diagnosis", page: 16, level: 1 },
  { title: "Chapter 3: Management", page: 20, level: 0 },
  { title: "3.1 Treatment", page: 20, level: 1 },
  { title: "3.2 Follow-up", page: 24, level: 1 },
  { title: "References", page: 28, level: 0 },
];

export default function NotesViewerClient({
  lesson,
  pdfUrl,
  siblings,
}: {
  lesson: Lesson;
  pdfUrl: string | null;
  siblings: Sibling[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"notes" | "bookmarks" | "search">("notes");
  const [darkPdf, setDarkPdf] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [penMode, setPenMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [currentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes(prev => [
      { id: crypto.randomUUID(), text: newNote.trim(), createdAt: new Date().toLocaleTimeString() },
      ...prev,
    ]);
    setNewNote("");
    setSaved(false);
  };

  const deleteNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));

  const addBookmark = () => {
    if (bookmarks.find(b => b.page === currentPage)) return;
    setBookmarks(prev => [...prev, { id: crypto.randomUUID(), page: currentPage, label: `Page ${currentPage}` }]);
  };

  const filteredOutline = searchQuery
    ? OUTLINE.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : OUTLINE;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)", background: "var(--c-bg)" }}>
      {/* ── TOP BAR ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0 z-10"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <Link
          href="/courses"
          className="flex items-center gap-1.5 text-sm transition hover:text-white shrink-0"
          style={{ color: "var(--c-text-3)" }}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="h-4 w-px" style={{ background: "var(--c-border)" }} />
        <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--c-brand)" }} />
        <h1 className="text-sm font-semibold truncate flex-1" style={{ color: "var(--c-text-1)" }}>
          {lesson.documentName}
        </h1>
        <button
          onClick={addBookmark}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40 shrink-0"
          style={{
            borderColor: bookmarks.find(b => b.page === currentPage) ? "var(--c-brand)" : "var(--c-border)",
            color: bookmarks.find(b => b.page === currentPage) ? "var(--c-brand)" : "var(--c-text-3)",
          }}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Bookmark
        </button>
      </div>

      {/* ── BODY (sidebar + pdf + right panel) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR — Outline */}
        <aside
          className="flex flex-col border-r shrink-0 transition-all duration-300"
          style={{
            width: sidebarOpen ? "220px" : "0px",
            overflow: "hidden",
            borderColor: "var(--c-border)",
            background: "var(--c-surface)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: "var(--c-border)" }}
          >
            <div className="flex items-center gap-2">
              <List className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--c-text-1)" }}>
                Outline
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1 transition hover:bg-black/10"
            >
              <X className="h-3.5 w-3.5" style={{ color: "var(--c-text-3)" }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {OUTLINE.map((item, i) => (
              <button
                key={i}
                className="w-full text-left flex items-center gap-2 py-2 text-sm transition hover:bg-black/5"
                style={{
                  paddingLeft: `${12 + item.level * 14}px`,
                  paddingRight: "12px",
                  color: item.level === 0 ? "var(--c-text-1)" : "var(--c-text-3)",
                  fontWeight: item.level === 0 ? "600" : "400",
                }}
              >
                {item.level === 0
                  ? <BookOpen className="h-3 w-3 shrink-0" style={{ color: "var(--c-brand)" }} />
                  : <div className="h-1 w-1 rounded-full shrink-0" style={{ background: "var(--c-text-4)" }} />
                }
                <span className="truncate text-xs">{item.title}</span>
                <span className="ml-auto text-[10px] shrink-0" style={{ color: "var(--c-text-4)" }}>
                  p.{item.page}
                </span>
              </button>
            ))}

            {siblings.length > 0 && (
              <>
                <div className="mt-4 px-3 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--c-text-4)" }}>
                    Course Lessons
                  </span>
                </div>
                {siblings.map(s => (
                  <Link
                    key={s.id}
                    href={`/notes/${s.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs transition hover:bg-black/5"
                    style={{ color: s.id === lesson.id ? "var(--c-brand)" : "var(--c-text-3)" }}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* CENTER — PDF Viewer */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {/* Pdf area */}
          <div
            className="flex-1 relative overflow-auto"
            style={{ filter: darkPdf ? "invert(1) hue-rotate(180deg)" : "none" }}
          >
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-xl border transition hover:border-brand/40"
                style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                title="Show Outline"
              >
                <Menu className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
              </button>
            )}

            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`}
                className="w-full border-0"
                style={{
                  height: "100%",
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: "top center",
                  minHeight: zoom !== 100 ? `${100 / (zoom / 100)}%` : "100%",
                }}
                title={lesson.title}
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center h-full gap-4"
                style={{ color: "var(--c-text-3)" }}
              >
                <FileX className="h-16 w-16 opacity-20" />
                <p className="text-sm">No PDF attached to this lesson</p>
                <Link href="/courses" className="btn-ghost text-sm">Browse courses</Link>
              </div>
            )}
          </div>

          {/* FLOATING TOOLBAR */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-2xl border px-3 py-2"
            style={{
              background: "var(--c-card)",
              borderColor: "var(--c-border)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
              backdropFilter: "blur(12px)",
              zIndex: 20,
            }}
          >
            {/* Zoom out */}
            <button
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-black/10"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
            </button>
            <span
              className="text-xs font-semibold w-10 text-center select-none"
              style={{ color: "var(--c-text-3)" }}
            >
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-black/10"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
            </button>

            <div className="w-px h-5 mx-1" style={{ background: "var(--c-border)" }} />

            {/* Highlight */}
            <button
              onClick={() => { setHighlightMode(h => !h); setPenMode(false); }}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition"
              style={{ background: highlightMode ? "rgba(251,191,36,0.15)" : "transparent" }}
              title="Highlight Mode"
            >
              <Highlighter className="h-4 w-4" style={{ color: highlightMode ? "#fbbf24" : "var(--c-text-2)" }} />
            </button>

            {/* Pen */}
            <button
              onClick={() => { setPenMode(p => !p); setHighlightMode(false); }}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition"
              style={{ background: penMode ? "rgba(96,165,250,0.15)" : "transparent" }}
              title="Pen Mode"
            >
              <PenLine className="h-4 w-4" style={{ color: penMode ? "#60a5fa" : "var(--c-text-2)" }} />
            </button>

            <div className="w-px h-5 mx-1" style={{ background: "var(--c-border)" }} />

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkPdf(d => !d)}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition"
              style={{ background: darkPdf ? "rgba(167,139,250,0.15)" : "transparent" }}
              title="Toggle PDF Dark Mode"
            >
              {darkPdf
                ? <Sun className="h-4 w-4" style={{ color: "#a78bfa" }} />
                : <Moon className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
              }
            </button>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside
          className="w-72 flex flex-col border-l shrink-0"
          style={{ borderColor: "var(--c-border)", background: "var(--c-surface)" }}
        >
          {/* Tabs */}
          <div className="flex border-b shrink-0" style={{ borderColor: "var(--c-border)" }}>
            {(["notes", "bookmarks", "search"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className="flex-1 py-3 text-xs font-semibold capitalize transition"
                style={{
                  color: rightTab === tab ? "var(--c-brand)" : "var(--c-text-3)",
                  borderBottom: rightTab === tab ? "2px solid var(--c-brand)" : "2px solid transparent",
                  background: "transparent",
                }}
              >
                {tab === "notes" ? "📝 Notes" : tab === "bookmarks" ? "🔖 Bookmarks" : "🔍 Search"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* NOTES TAB */}
            {rightTab === "notes" && (
              <div className="flex flex-col gap-3 h-full">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addNote(); }}
                  placeholder="Write a quick note… (⌘+Enter to save)"
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none transition"
                  style={{
                    background: "var(--c-input-bg)",
                    borderColor: "var(--c-input-border)",
                    color: "var(--c-text-1)",
                  }}
                />
                <button
                  onClick={addNote}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}
                >
                  <Plus className="h-4 w-4" /> Add Note
                </button>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {notes.length === 0 && (
                    <p className="text-center text-xs py-8" style={{ color: "var(--c-text-4)" }}>
                      No notes yet.
                      <br />Add your first note above.
                    </p>
                  )}
                  {notes.map(note => (
                    <div
                      key={note.id}
                      className="rounded-xl border p-3 group"
                      style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold" style={{ color: "var(--c-brand)" }}>
                          {note.createdAt}
                        </span>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="rounded p-0.5 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
                        </button>
                      </div>
                      <p className="text-sm leading-6" style={{ color: "var(--c-text-2)" }}>
                        {note.text}
                      </p>
                    </div>
                  ))}
                </div>

                {notes.length > 0 && (
                  <button
                    onClick={() => { setSaved(true); }}
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-2 text-xs font-semibold border transition hover:border-brand/40"
                    style={{ borderColor: saved ? "var(--c-brand)" : "var(--c-border)", color: saved ? "var(--c-brand)" : "var(--c-text-3)" }}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saved ? "Notes saved ✓" : "Save all notes"}
                  </button>
                )}
              </div>
            )}

            {/* BOOKMARKS TAB */}
            {rightTab === "bookmarks" && (
              <div className="space-y-2">
                {bookmarks.length === 0 && (
                  <div className="text-center py-10">
                    <Bookmark
                      className="h-10 w-10 mx-auto mb-3 opacity-20"
                      style={{ color: "var(--c-text-3)" }}
                    />
                    <p className="text-xs" style={{ color: "var(--c-text-4)" }}>
                      No bookmarks yet.
                      <br />Click &ldquo;Bookmark&rdquo; in the top bar.
                    </p>
                  </div>
                )}
                {bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    className="flex items-center justify-between rounded-xl border p-3"
                    style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>
                        {bm.label}
                      </span>
                    </div>
                    <button
                      onClick={() => setBookmarks(prev => prev.filter(b => b.id !== bm.id))}
                      className="rounded-lg p-1 transition hover:bg-red-500/10"
                    >
                      <X className="h-3.5 w-3.5" style={{ color: "var(--c-text-4)" }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SEARCH TAB */}
            {rightTab === "search" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--c-text-4)" }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search sections…"
                    className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                    style={{
                      background: "var(--c-input-bg)",
                      borderColor: "var(--c-input-border)",
                      color: "var(--c-text-1)",
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  {searchQuery && filteredOutline.length === 0 && (
                    <p className="text-center text-xs py-6" style={{ color: "var(--c-text-4)" }}>
                      No sections found
                    </p>
                  )}
                  {filteredOutline.map((item, i) => (
                    <button
                      key={i}
                      className="w-full text-left rounded-xl border p-3 transition hover:border-brand/30"
                      style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                    >
                      <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>
                        {item.title}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        Page {item.page}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
