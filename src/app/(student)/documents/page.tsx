"use client";

/**
 * Documents Workspace — main entry for lesson/lecture/qbank/document workspaces.
 * Replaces the old standalone /notes page. Every note created from anywhere
 * in the app is saved here, organized by category:
 *   subject, lecture, qbank, qbank-active, documents
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  ClipboardList,
  FileText,
  Filter,
  GraduationCap,
  Library,
  Loader2,
  Plus,
  Search,
  Stethoscope,
  Target,
} from "lucide-react";

type Category = "subject" | "lecture" | "qbank" | "qbank-active" | "documents";

type Workspace = {
  id: string;
  title: string | null;
  category: Category;
  pinned: boolean;
  lesson_id: string | null;
  updated_at: string;
  legacy_body: string | null;
};

type LessonOption = {
  id: string;
  title: string;
  kind: string;
  source_kind: Category;
  course_title: string | null;
};

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; tint: string }> = {
  subject: { label: "Subject Notes", icon: <Stethoscope className="h-4 w-4" />, tint: "from-cyan-500/20 to-cyan-300/5 text-cyan-300" },
  lecture: { label: "Lecture Notes", icon: <GraduationCap className="h-4 w-4" />, tint: "from-emerald-500/20 to-emerald-300/5 text-emerald-300" },
  qbank: { label: "QBank Notes", icon: <BookOpenCheck className="h-4 w-4" />, tint: "from-amber-500/20 to-amber-300/5 text-amber-300" },
  "qbank-active": { label: "Active QBank", icon: <Target className="h-4 w-4" />, tint: "from-rose-500/20 to-rose-300/5 text-rose-300" },
  documents: { label: "Documents Notes", icon: <FileText className="h-4 w-4" />, tint: "from-violet-500/20 to-violet-300/5 text-violet-300" },
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DocumentsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState<string>("");
  const [creating, setCreating] = useState<Category | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, lsRes] = await Promise.all([
        fetch("/api/workspaces?limit=200"),
        fetch("/api/workspaces/lessons"),
      ]);
      const ws = await wsRes.json();
      const ls = await lsRes.json();
      if (!wsRes.ok) throw new Error(ws?.error || "Failed to load");
      setWorkspaces(ws.workspaces ?? []);
      setLessons(ls.lessons ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<Category, Workspace[]> = {
      subject: [], lecture: [], qbank: [], "qbank-active": [], documents: [],
    };
    for (const w of workspaces) {
      if (filter !== "all" && w.category !== filter) continue;
      if (search && !((w.title || w.legacy_body || "") as string).toLowerCase().includes(search.toLowerCase())) continue;
      m[w.category].push(w);
    }
    return m;
  }, [workspaces, filter, search]);

  async function createWorkspace(category: Category, lessonId?: string) {
    setCreating(category);
    try {
      let title = "";
      let lessonIdForWorkspace = lessonId ?? null;
      const lesson = lessonId ? lessons.find((l) => l.id === lessonId) : null;
      if (lesson) {
        title = lesson.title;
      } else {
        title =
          prompt(`Name your new "${CATEGORY_META[category].label}" workspace`, CATEGORY_META[category].label) ||
          CATEGORY_META[category].label;
      }
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          lesson_id: lessonIdForWorkspace,
          blocks: [],
          legacy_body: "",
          meta: { origin: "documents-page" },
          pinned: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create workspace");
      window.location.href = `/documents/${data.workspace.id}`;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create workspace");
      setCreating(null);
    }
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title text-3xl">
            <span className="inline-flex items-center gap-3">
              <Library className="h-7 w-7 text-emerald-400" />
              Documents Workspace
            </span>
          </h1>
          <p className="mt-1 max-w-3xl text-slate-400">
            Every note you create — from any lesson, lecture, QBank, or document — is saved
            automatically under its source category. Click any card to open the rich-text
            workspace (Notion-like block editor) with split, full-screen, focus and light / dark modes.
          </p>
        </div>
        <Link
          href="/knowledge"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Back to Library
        </Link>
      </div>

      {/* Filter & Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Category | "all")}
            className="bg-transparent text-sm text-slate-200 outline-none"
          >
            <option value="all">All categories</option>
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles and note bodies"
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => void loadAll()}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {/* Quick create */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => void createWorkspace(c)}
            disabled={creating === c}
            className={`group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${CATEGORY_META[c].tint} p-4 text-left transition hover:border-white/20`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30">
              {CATEGORY_META[c].icon}
            </span>
            <span className="text-sm font-semibold">{CATEGORY_META[c].label}</span>
            <span className="text-xs text-slate-400">New workspace</span>
            {creating === c && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-300" />
            )}
          </button>
        ))}
      </div>

      {/* Attach-from-lesson shortcut */}
      {lessons.length > 0 && (
        <details className="mb-6 rounded-xl border border-white/10 bg-white/5 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Attach workspace to an existing lesson
          </summary>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <ul className="grid gap-1.5 md:grid-cols-2">
              {lessons.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => void createWorkspace(l.source_kind, l.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-white/10"
                  >
                    <span>
                      <span className="font-medium">{l.title}</span>
                      <span className="ml-2 text-xs text-slate-500">{l.course_title ?? l.kind}</span>
                    </span>
                    <Plus className="h-4 w-4 text-emerald-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* List */}
      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
            const items = grouped[c];
            if (!items.length) return null;
            return (
              <section key={c}>
                <h2 className={`mb-2 flex items-center gap-2 text-sm font-semibold ${CATEGORY_META[c].tint}`}>
                  {CATEGORY_META[c].icon}
                  {CATEGORY_META[c].label}
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-400">{items.length}</span>
                </h2>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/documents/${w.id}`}
                        className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 text-base font-semibold text-white">
                            {w.title || CATEGORY_META[w.category].label}
                          </h3>
                          {w.pinned && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Pinned</span>}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-400">
                          {w.legacy_body ? w.legacy_body.slice(0, 140) : "Empty workspace — click to start writing."}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            Updated {timeAgo(w.updated_at)}
                          </span>
                          <span className="opacity-0 transition group-hover:opacity-100">Open →</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {workspaces.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-slate-400">
              Empty. Click any of the colored cards above to create your first workspace.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
