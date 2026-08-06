"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, PlaySquare, List, PictureInPicture2, Download,
  Bookmark, FileText, AlignLeft, Gauge, X, ChevronRight,
  ChevronDown, Volume2, Maximize2, BookmarkCheck,
} from "lucide-react";

type Lesson = { id: string; title: string; kind: string };
type PlaylistItem = { id: string; title: string; active: boolean };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoPlayerClient({
  lesson,
  embedUrl,
  videoType,
  playlist,
  initialNotes,
  transcript,
  attachmentUrl,
  attachmentName,
}: {
  lesson: Lesson;
  embedUrl: string | null;
  videoType: "youtube" | "vimeo" | "direct" | "none";
  playlist: PlaylistItem[];
  initialNotes: string;
  transcript: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [bottomTab, setBottomTab] = useState<"notes" | "transcript" | "downloads" | "bookmarks">("notes");
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const [notes, setNotes] = useState(initialNotes);
  const [notesSaved, setNotesSaved] = useState(false);
  const [bookmarks, setBookmarks] = useState<{ id: string; label: string; time: string }[]>([]);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  const handleSpeedChange = (s: number) => {
    setSpeed(s);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const handlePiP = useCallback(async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      setPipActive(false);
    } else {
      await videoRef.current.requestPictureInPicture();
      setPipActive(true);
    }
  }, []);

  const addBookmark = () => {
    const time = videoRef.current
      ? new Date(videoRef.current.currentTime * 1000).toISOString().slice(11, 19)
      : "0:00";
    setBookmarks(prev => [...prev, { id: crypto.randomUUID(), label: `Bookmark at ${time}`, time }]);
  };

  const isDirectVideo = videoType === "direct";
  const canControl = isDirectVideo;

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 4rem)", background: "var(--c-bg)" }}>

      {/* ── TOP BAR ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <Link
          href="/videos"
          className="flex items-center gap-1.5 text-sm transition hover:text-white shrink-0"
          style={{ color: "var(--c-text-3)" }}
        >
          <ChevronLeft className="h-4 w-4" /> Videos
        </Link>
        <div className="h-4 w-px" style={{ background: "var(--c-border)" }} />
        <PlaySquare className="h-4 w-4 shrink-0" style={{ color: "var(--c-brand)" }} />
        <h1 className="text-sm font-semibold truncate flex-1" style={{ color: "var(--c-text-1)" }}>
          {lesson.title}
        </h1>

        {/* Speed (only for direct video) */}
        {canControl && (
          <div className="relative shrink-0">
            <button
              onClick={() => setSpeedOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40"
              style={{ borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
            >
              <Gauge className="h-3.5 w-3.5" />
              {speed}×
              <ChevronDown className="h-3 w-3" />
            </button>
            {speedOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl border overflow-hidden z-50"
                style={{ background: "var(--c-card)", borderColor: "var(--c-border)", minWidth: "80px" }}
              >
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className="w-full text-left px-4 py-2 text-xs transition hover:bg-black/10"
                    style={{ color: s === speed ? "var(--c-brand)" : "var(--c-text-2)", fontWeight: s === speed ? "700" : "400" }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PiP (only for direct video) */}
        {canControl && (
          <button
            onClick={handlePiP}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40 shrink-0"
            style={{
              borderColor: pipActive ? "var(--c-brand)" : "var(--c-border)",
              color: pipActive ? "var(--c-brand)" : "var(--c-text-2)",
            }}
            title="Picture in Picture"
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
            PiP
          </button>
        )}

        {/* Playlist toggle */}
        <button
          onClick={() => setPlaylistOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40 shrink-0"
          style={{ borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
          title="Toggle Playlist"
        >
          <List className="h-3.5 w-3.5" />
          Playlist
        </button>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* VIDEO + BOTTOM TABS (left/center) */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* VIDEO PLAYER */}
          <div
            className="relative w-full shrink-0"
            style={{ background: "#000", aspectRatio: "16/9", maxHeight: "60vh" }}
          >
            {embedUrl && videoType !== "none" ? (
              videoType === "direct" ? (
                <video
                  ref={videoRef}
                  src={embedUrl}
                  controls
                  className="w-full h-full"
                  style={{ maxHeight: "60vh" }}
                  onEnded={() => setPipActive(false)}
                />
              ) : (
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title={lesson.title}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-4" style={{ color: "#6b7280" }}>
                <PlaySquare className="h-20 w-20 opacity-20" />
                <p className="text-sm">No video available for this lesson</p>
              </div>
            )}
          </div>

          {/* BOTTOM TABS BAR */}
          <div
            className="flex border-b shrink-0"
            style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
          >
            {(["notes", "transcript", "downloads", "bookmarks"] as const).map(tab => {
              const icons = {
                notes: <FileText className="h-3.5 w-3.5" />,
                transcript: <AlignLeft className="h-3.5 w-3.5" />,
                downloads: <Download className="h-3.5 w-3.5" />,
                bookmarks: <Bookmark className="h-3.5 w-3.5" />,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className="flex items-center gap-1.5 px-5 py-3 text-xs font-semibold capitalize transition"
                  style={{
                    color: bottomTab === tab ? "var(--c-brand)" : "var(--c-text-3)",
                    borderBottom: bottomTab === tab ? "2px solid var(--c-brand)" : "2px solid transparent",
                  }}
                >
                  {icons[tab]}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}

            {/* Speed selector for iframe/embed (since JS can't control it) */}
            {!canControl && (
              <div className="ml-auto flex items-center gap-2 pr-4">
                <div className="relative">
                  <button
                    onClick={() => setSpeedOpen(o => !o)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40"
                    style={{ borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
                  >
                    <Gauge className="h-3.5 w-3.5" /> Speed: {speed}×
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {speedOpen && (
                    <div
                      className="absolute right-0 bottom-full mb-1 rounded-xl border overflow-hidden z-50"
                      style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                    >
                      {SPEEDS.map(s => (
                        <button
                          key={s}
                          onClick={() => { setSpeed(s); setSpeedOpen(false); }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-black/10"
                          style={{ color: s === speed ? "var(--c-brand)" : "var(--c-text-2)", fontWeight: s === speed ? "700" : "400" }}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM TAB CONTENT */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* NOTES */}
            {bottomTab === "notes" && (
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "var(--c-text-1)" }}>My Notes</h2>
                  <button
                    onClick={() => setNotesSaved(true)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40"
                    style={{ borderColor: notesSaved ? "var(--c-brand)" : "var(--c-border)", color: notesSaved ? "var(--c-brand)" : "var(--c-text-3)" }}
                  >
                    {notesSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    {notesSaved ? "Saved ✓" : "Save notes"}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
                  placeholder="Take notes while watching the video…"
                  rows={10}
                  className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none leading-7"
                  style={{
                    background: "var(--c-input-bg)",
                    borderColor: "var(--c-input-border)",
                    color: "var(--c-text-1)",
                  }}
                />
              </div>
            )}

            {/* TRANSCRIPT */}
            {bottomTab === "transcript" && (
              <div className="max-w-3xl mx-auto">
                <h2 className="text-sm font-bold mb-4" style={{ color: "var(--c-text-1)" }}>Transcript</h2>
                {transcript ? (
                  <div
                    className="text-sm leading-8 whitespace-pre-wrap rounded-xl border p-5"
                    style={{ background: "var(--c-card)", borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
                  >
                    {transcript}
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center py-16 rounded-xl border"
                    style={{ borderColor: "var(--c-border)", background: "var(--c-card)" }}
                  >
                    <AlignLeft className="h-10 w-10 opacity-20 mb-3" style={{ color: "var(--c-text-3)" }} />
                    <p className="text-sm" style={{ color: "var(--c-text-4)" }}>No transcript available for this video.</p>
                  </div>
                )}
              </div>
            )}

            {/* DOWNLOADS */}
            {bottomTab === "downloads" && (
              <div className="max-w-3xl mx-auto">
                <h2 className="text-sm font-bold mb-4" style={{ color: "var(--c-text-1)" }}>Downloads</h2>
                {attachmentUrl ? (
                  <a
                    href={attachmentUrl}
                    download={attachmentName ?? "study-file"}
                    className="flex items-center gap-4 rounded-xl border p-4 transition hover:border-brand/40 group"
                    style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                      style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
                    >
                      <Download className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>
                        {attachmentName ?? "Study File"}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        Click to download
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition" style={{ color: "var(--c-text-3)" }} />
                  </a>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center py-16 rounded-xl border"
                    style={{ borderColor: "var(--c-border)", background: "var(--c-card)" }}
                  >
                    <Download className="h-10 w-10 opacity-20 mb-3" style={{ color: "var(--c-text-3)" }} />
                    <p className="text-sm" style={{ color: "var(--c-text-4)" }}>No files available for download.</p>
                  </div>
                )}
              </div>
            )}

            {/* BOOKMARKS */}
            {bottomTab === "bookmarks" && (
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold" style={{ color: "var(--c-text-1)" }}>Bookmarks</h2>
                  <button
                    onClick={addBookmark}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition hover:border-brand/40"
                    style={{ borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {canControl ? "Bookmark current time" : "Add bookmark"}
                  </button>
                </div>

                {bookmarks.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-16 rounded-xl border"
                    style={{ borderColor: "var(--c-border)", background: "var(--c-card)" }}
                  >
                    <Bookmark className="h-10 w-10 opacity-20 mb-3" style={{ color: "var(--c-text-3)" }} />
                    <p className="text-sm" style={{ color: "var(--c-text-4)" }}>No bookmarks yet. Add one above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookmarks.map(bm => (
                      <div
                        key={bm.id}
                        className="flex items-center gap-3 rounded-xl border p-4"
                        style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                          style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
                        >
                          <Bookmark className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>{bm.label}</div>
                        </div>
                        <button
                          onClick={() => setBookmarks(prev => prev.filter(b => b.id !== bm.id))}
                          className="rounded-lg p-1.5 transition hover:bg-red-500/10"
                        >
                          <X className="h-3.5 w-3.5" style={{ color: "var(--c-text-4)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR — Playlist ── */}
        {playlistOpen && (
          <aside
            className="w-80 flex flex-col border-l shrink-0"
            style={{ borderColor: "var(--c-border)", background: "var(--c-surface)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: "var(--c-border)" }}
            >
              <div className="flex items-center gap-2">
                <List className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--c-text-1)" }}>
                  Playlist
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
                >
                  {playlist.length}
                </span>
              </div>
              <button
                onClick={() => setPlaylistOpen(false)}
                className="rounded-lg p-1 transition hover:bg-black/10"
              >
                <X className="h-3.5 w-3.5" style={{ color: "var(--c-text-3)" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {playlist.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--c-text-4)" }}>
                  <PlaySquare className="h-8 w-8 opacity-30" />
                  <p className="text-xs text-center">No other videos in this course.</p>
                </div>
              )}
              {playlist.map((item, idx) => (
                <Link
                  key={item.id}
                  href={`/videos/${item.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-black/5 group"
                  style={{
                    background: item.active ? "rgba(16,185,129,0.06)" : "transparent",
                    borderLeft: item.active ? "2px solid var(--c-brand)" : "2px solid transparent",
                  }}
                >
                  {/* Thumbnail placeholder */}
                  <div
                    className="relative flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ width: "72px", height: "48px", background: "var(--c-elevated)" }}
                  >
                    <PlaySquare
                      className="h-5 w-5"
                      style={{ color: item.active ? "var(--c-brand)" : "var(--c-text-4)" }}
                    />
                    <div
                      className="absolute top-1 left-1 rounded text-[9px] font-bold px-1"
                      style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
                    >
                      {idx + 1}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold leading-5 line-clamp-2"
                      style={{ color: item.active ? "var(--c-brand)" : "var(--c-text-1)" }}
                    >
                      {item.title}
                    </p>
                    {item.active && (
                      <span className="text-[10px] font-bold" style={{ color: "var(--c-brand)" }}>
                        ▶ Now playing
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
