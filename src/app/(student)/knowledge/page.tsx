"use client";

import { useEffect, useState } from "react";
import { BookmarkPlus, Highlighter, PencilLine, Trash2, Loader2, BookOpen, AlertCircle } from "lucide-react";

type LibraryEntryData = {
  question_id?: string | number | null;
  subject_label?: string | null;
  answer_key?: string | number | null;
};

type LibraryEntry = {
  id: string;
  entry_type: "bookmark" | "highlight" | "note";
  title: string | null;
  body: string | null;
  quote: string | null;
  color: string | null;
  data: LibraryEntryData | null;
  created_at: string;
};

type Tab = "all" | "bookmark" | "highlight" | "note";

const TYPE_ICON: Record<string, React.ReactNode> = {
  bookmark: <BookmarkPlus className="h-4 w-4" />,
  highlight: <Highlighter className="h-4 w-4" />,
  note: <PencilLine className="h-4 w-4" />,
};

const TYPE_COLOR: Record<string, string> = {
  bookmark: "text-blue-400 bg-blue-400/10 border-blue-500/20",
  highlight: "text-yellow-400 bg-yellow-400/10 border-yellow-500/20",
  note: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20",
};

const TYPE_LABEL: Record<string, string> = {
  bookmark: "Bookmark",
  highlight: "Highlight",
  note: "Note",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function MedicalLibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/medical-library?limit=200");
      if (!res.ok) throw new Error("Failed to load library");
      const data: { entries?: LibraryEntry[] } = await res.json();
      setEntries(data.entries ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEntries(); }, []);

  async function deleteEntry(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/medical-library?id=${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const filtered: LibraryEntry[] = tab === "all" ? entries : entries.filter((e) => e.entry_type === tab);
  const counts = {
    all: entries.length,
    bookmark: entries.filter((e) => e.entry_type === "bookmark").length,
    highlight: entries.filter((e) => e.entry_type === "highlight").length,
    note: entries.filter((e) => e.entry_type === "note").length,
  };

  return (
    <div className="min-h-[100dvh] bg-[#08101f] pb-16">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Medical Library</h1>
            <p className="text-sm text-slate-400">Your saved bookmarks, highlights &amp; notes</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(["all", "bookmark", "highlight", "note"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition
                ${tab === t
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-ink-700 bg-ink-900 text-slate-400 hover:text-white"
                }`}
            >
              {t !== "all" && TYPE_ICON[t]}
              {t === "all" ? "All" : TYPE_LABEL[t]}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === t ? "bg-brand/20 text-brand" : "bg-ink-700 text-slate-500"}`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading library…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-12 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-ink-800 text-slate-500">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold text-slate-300">
              {tab === "all" ? "Your library is empty" : `No ${TYPE_LABEL[tab].toLowerCase()}s yet`}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Use the <span className="text-brand">Highlight</span>, <span className="text-brand">Bookmark</span>, and <span className="text-brand">Note</span> buttons while studying to save content here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry: LibraryEntry) => {
              const quote = typeof entry.quote === "string" && entry.quote.trim().length > 0 ? entry.quote : null;
              const noteBody = typeof entry.body === "string" && entry.body.trim().length > 0 ? entry.body : null;
              const meta = entry.data;
              const hasQuestionId = meta?.question_id != null && String(meta.question_id).trim().length > 0;
              const subjectLabel = typeof meta?.subject_label === "string" && meta.subject_label.trim().length > 0 ? meta.subject_label : null;
              const answerKey = meta?.answer_key != null && String(meta.answer_key).trim().length > 0 ? String(meta.answer_key) : null;

              return (
              <div
                key={entry.id}
                className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4 transition hover:border-ink-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Color dot */}
                    <div
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color ?? "#60a5fa" }}
                    />
                    <div className="min-w-0 flex-1">
                      {/* Type badge */}
                      <span className={`mb-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_COLOR[entry.entry_type]}`}>
                        {TYPE_ICON[entry.entry_type]}
                        {TYPE_LABEL[entry.entry_type]}
                      </span>

                      {/* Title */}
                      {entry.title && (
                        <div className="mb-1 font-semibold text-slate-100 leading-tight">
                          {entry.title}
                        </div>
                      )}

                      {/* Quote (highlighted/bookmarked text) */}
                      {quote ? (
                        <blockquote className="mt-1 border-l-2 border-slate-600 pl-3 text-sm leading-6 text-slate-300 italic">
                          {quote.length > 280 ? `${quote.slice(0, 280)}…` : quote}
                        </blockquote>
                      ) : null}

                      {/* Note body */}
                      {noteBody ? (
                        <div className="mt-2 text-sm leading-6 text-slate-200">
                          {noteBody}
                        </div>
                      ) : null}

                      {/* QBank metadata */}
                      {hasQuestionId ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {subjectLabel ? (
                            <span className="rounded border border-ink-700 bg-ink-800 px-2 py-0.5">
                              {subjectLabel}
                            </span>
                          ) : null}
                          {answerKey ? (
                            <span className="rounded border border-ink-700 bg-ink-800 px-2 py-0.5">
                              Answer: {answerKey}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Date */}
                      <div className="mt-2 text-[11px] text-slate-600">
                        {formatDate(entry.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => void deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    className="shrink-0 grid h-8 w-8 place-items-center rounded-xl text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
                    title="Delete"
                  >
                    {deleting === entry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
