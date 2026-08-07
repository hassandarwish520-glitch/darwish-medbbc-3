"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Focus,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Trash2,
  Pi,
  BookOpen,
} from "lucide-react";
import BlockEditor from "@/components/BlockEditor";
import type { Block } from "@/components/BlockEditor";
import AnnotationPanel from "@/components/AnnotationPanel";

export type { Block } from "@/components/BlockEditor";

export type Category = "subject" | "lecture" | "qbank" | "qbank-active" | "documents";

export type WorkspaceData = {
  id: string;
  title: string | null;
  category: Category;
  blocks: Block[];
  legacy_body: string | null;
  lesson_id: string | null;
  meta: Record<string, unknown>;
  pinned: boolean;
  updated_at: string;
};

export type LessonLite = {
  id: string;
  title: string;
  document_url: string | null;
  document_name: string | null;
  document_mime: string | null;
  kind: string;
  course_title: string | null;
};

const CATEGORY_LABEL: Record<Category, string> = {
  subject: "Subject Notes",
  lecture: "Lecture Notes",
  qbank: "QBank Notes",
  "qbank-active": "Active QBank",
  documents: "Documents Notes",
};
const CATEGORY_TINT: Record<Category, string> = {
  subject: "bg-cyan-500/15 text-cyan-300",
  lecture: "bg-emerald-500/15 text-emerald-300",
  qbank: "bg-amber-500/15 text-amber-300",
  "qbank-active": "bg-rose-500/15 text-rose-300",
  documents: "bg-violet-500/15 text-violet-300",
};

type UiMode = "light" | "dark" | "sepia";
const STORAGE_DRAFT = (id: string) => `documentsws:draft:${id}`;
const STORAGE_UI = (id: string) => `documentsws:ui:${id}`;

function emptyBlocks(existing?: Block[]): Block[] {
  if (existing && existing.length) return existing;
  return [
    { id: crypto.randomUUID(), type: "heading1", text: "Workspace" },
    { id: crypto.randomUUID(), type: "callout", text: "Write your first note — type freely. Use the toolbar above for rich content." },
  ];
}

function plainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "table" && Array.isArray(b.rows)) return b.rows.map((r) => r.join(" | ")).join("\n");
      return (b.text ?? b.caption ?? "") as string;
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

export default function DocumentWorkspaceClient({
  workspace: initialWorkspace,
  lesson,
  isAdmin,
}: {
  workspace: WorkspaceData;
  lesson: LessonLite | null;
  isAdmin: boolean;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceData>(initialWorkspace);
  const [title, setTitle] = useState<string>(initialWorkspace.title ?? "");
  const [blocks, setBlocks] = useState<Block[]>(emptyBlocks(initialWorkspace.blocks));
  const [theme, setTheme] = useState<UiMode>("dark");
  const [split, setSplit] = useState<boolean>(true);
  const [focus, setFocus] = useState<boolean>(false);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [published, setPublished] = useState<boolean>(!!initialWorkspace.meta?.published);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<string>(initialWorkspace.updated_at);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Hydrate UI preferences
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_UI(workspace.id));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.theme) setTheme(parsed.theme);
      if (typeof parsed?.split === "boolean") setSplit(parsed.split);
      if (typeof parsed?.focus === "boolean") setFocus(parsed.focus);
      if (typeof parsed?.fullscreen === "boolean") setFullscreen(parsed.fullscreen);
    } catch {
      /* ignore */
    }
  }, [workspace.id]);

  // Persist UI prefs
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_UI(workspace.id),
        JSON.stringify({ theme, split, focus, fullscreen })
      );
    } catch {
      /* ignore */
    }
  }, [workspace.id, theme, split, focus, fullscreen]);

  // Hydrate from auto-saved draft (only if newer than server copy)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT(workspace.id));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const updatedAt = new Date(parsed.updatedAt ?? 0).getTime();
      const serverAt = new Date(initialWorkspace.updated_at).getTime();
      if (updatedAt <= serverAt) return;
      if (typeof parsed.title === "string") setTitle(parsed.title);
      if (Array.isArray(parsed.blocks) && parsed.blocks.length) setBlocks(parsed.blocks);
      setDirty(true);
    } catch {
      /* ignore */
    }
  }, [workspace.id, initialWorkspace.updated_at]);

  // Persist draft on changes
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_DRAFT(workspace.id),
        JSON.stringify({ title, blocks, updatedAt: new Date().toISOString() })
      );
    } catch {
      /* ignore */
    }
  }, [workspace.id, title, blocks]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const meta = { ...(workspace.meta ?? {}), published: isAdmin ? published : workspace.meta?.published ?? false };
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workspace.id,
          title,
          blocks,
          meta,
          legacy_body: plainText(blocks),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      const updated = (data.workspace ?? {}) as Partial<WorkspaceData>;
      setWorkspace((prev) => ({ ...prev, ...updated, meta }));
      setSavedAt(updated.updated_at ?? new Date().toISOString());
      setDirty(false);
      try {
        localStorage.removeItem(STORAGE_DRAFT(workspace.id));
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [workspace.id, workspace.meta, title, blocks, isAdmin, published]);

  // Auto-save with debounce
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => {
      void save();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [dirty, save]);

  // Save on tab hidden
  useEffect(() => {
    function onHide() {
      if (dirtyRef.current) void save();
    }
    window.addEventListener("visibilitychange", onHide);
    return () => window.removeEventListener("visibilitychange", onHide);
  }, [save]);

  // Keyboard shortcut: Ctrl/⌘+S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  async function deleteWorkspace() {
    if (!confirm("Delete this workspace permanently?")) return;
    const res = await fetch(`/api/workspaces?id=${workspace.id}`, { method: "DELETE" });
    if (res.ok) {
      try { localStorage.removeItem(STORAGE_DRAFT(workspace.id)); } catch {}
      window.location.href = "/documents";
    }
  }

  const editorBg = useMemo(() => {
    switch (theme) {
      case "light": return "bg-white text-slate-900";
      case "sepia": return "bg-amber-50 text-amber-950";
      default: return "bg-slate-900 text-slate-100";
    }
  }, [theme]);

  const showAttached = !!lesson && split && !fullscreen && !focus;

  const leftPane = (
    <div className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-400" />
          <div className="truncate text-sm font-semibold text-slate-100">
            {lesson?.document_name ?? lesson?.title ?? "Original Document"}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="rounded bg-white/10 px-2 py-0.5">{lesson?.kind ?? "document"}</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-black">
        {lesson?.document_url ? (
          <div className="h-full overflow-auto p-3">
            <AnnotationPanel
              attachment={{
                href: lesson.document_url,
                mime: lesson.document_mime ?? "",
                name: lesson.document_name ?? lesson.title ?? "Document",
                lessonId: lesson.id,
                storageKey: `documentsws:annotation:${workspace.id}:${lesson.id ?? lesson.title ?? "doc"}`,
              }}
              lessonId={lesson.id}
              subjectSlug={
                typeof (lesson as { subject_slug?: string | null }).subject_slug === "string"
                  ? (lesson as { subject_slug?: string | null }).subject_slug ?? null
                  : null
              }
            />
          </div>
        ) : lesson ? (
          <div className="h-full overflow-auto p-3">
            <AnnotationPanel
              attachment={{
                href: lesson.kind === "html"
                  ? `/api/viewer/${lesson.id}/html`
                  : `/api/viewer/${lesson.id}/pdf`,
                mime: lesson.kind === "html" ? "text/html" : "application/pdf",
                name: lesson.title ?? "Lesson",
                lessonId: lesson.id,
                storageKey: `documentsws:annotation:${workspace.id}:${lesson.id}`,
              }}
              lessonId={lesson.id}
              subjectSlug={
                typeof (lesson as { subject_slug?: string | null }).subject_slug === "string"
                  ? (lesson as { subject_slug?: string | null }).subject_slug ?? null
                  : null
              }
            />
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-slate-400">
            <div>
              <Pi className="mx-auto mb-3 h-6 w-6 text-slate-500" />
              <p className="text-sm font-medium text-slate-200">No original document attached</p>
              <p className="mt-1 text-xs text-slate-500">
                This workspace will be saved under <span className={CATEGORY_TINT[workspace.category] + " rounded px-1.5"}>{CATEGORY_LABEL[workspace.category]}</span> inside the Library.
              </p>
              <p className="mt-3 text-[11px] text-slate-500">Notes you type here are auto-saved every second and persist across reloads.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const rightPane = (
    <div className={`flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-white/10 ${editorBg}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 ${editorBg}`}>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Workspace title"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-inherit outline-none placeholder:text-slate-500"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded px-2 py-1 font-medium ${CATEGORY_TINT[workspace.category]}`}>
            {CATEGORY_LABEL[workspace.category]}
          </span>
          {savedAt && !dirty && !saving && (
            <span className="text-slate-400">Saved {new Date(savedAt).toLocaleTimeString()}</span>
          )}
          {dirty && !saving && <span className="text-amber-300">Unsaved…</span>}
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 font-medium text-emerald-700 transition hover:bg-emerald-500/30 disabled:opacity-40 dark:text-emerald-300"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <BlockEditor
          initial={blocks}
          onChange={(b) => { setBlocks(b); setDirty(true); }}
          storageKey={STORAGE_DRAFT(workspace.id)}
        />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        {rightPane}
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="fixed right-4 top-4 z-[60] flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          <Minimize2 className="h-3.5 w-3.5" /> Exit fullscreen
        </button>
      </div>
    );
  }

  return (
    <div className={`page-shell ${focus ? "pb-0" : ""}`}>
      {/* Top toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/documents" className="btn-ghost px-3 py-1.5 text-sm">
            <ArrowLeft className="h-4 w-4" /> Documents
          </Link>
          <span className={`rounded px-2 py-1 text-[11px] font-medium ${CATEGORY_TINT[workspace.category]}`}>
            {CATEGORY_LABEL[workspace.category]}
          </span>
          {lesson && (
            <span className="rounded bg-white/5 px-2 py-1 text-[11px] text-slate-400">
              📌 {lesson.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-2 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(["light", "dark", "sepia"] as UiMode[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded px-2 py-1 text-xs capitalize ${theme === t ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "text-slate-400 hover:bg-white/10"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSplit((s) => !s)}
            className={`rounded px-2 py-1 text-xs ${split ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "text-slate-400 hover:bg-white/10"}`}
            title="Toggle split view"
          >
            Split: {split ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => setFocus((f) => !f)}
            className={`rounded px-2 py-1 text-xs ${focus ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "text-slate-400 hover:bg-white/10"}`}
            title="Focus mode"
          >
            <Focus className="inline h-3 w-3" /> Focus
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
            title="Full screen workspace"
          >
            <Maximize2 className="inline h-3 w-3" /> Fullscreen
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setPublished((p) => !p); setDirty(true); }}
              className={`rounded px-2 py-1 text-xs ${published ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "text-slate-400 hover:bg-white/10"}`}
              title="Publish this workspace so students can see it"
            >
              {published ? <Eye className="inline h-3 w-3" /> : <EyeOff className="inline h-3 w-3" />}
              {published ? "Published" : "Private"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void deleteWorkspace()}
            className="rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/15"
            title="Delete workspace"
          >
            <Trash2 className="inline h-3 w-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>
      )}

      <div
        className={`grid min-h-[78vh] gap-3 ${showAttached ? "lg:grid-cols-[1.05fr,1.3fr]" : "grid-cols-1"} ${
          focus ? "rounded-2xl border border-white/10 bg-black/30 p-2" : ""
        }`}
      >
        {showAttached && leftPane}
        {rightPane}
      </div>
    </div>
  );
}

function DocumentViewer({ lesson }: { lesson: LessonLite }) {
  const url = lesson.document_url ?? "";
  const mime = (lesson.document_mime ?? "").toLowerCase();
  const lower = url.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    return <iframe src={url} className="h-full w-full" title={lesson.document_name ?? "PDF"} />;
  }
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) {
    return (
      <div className="grid h-full place-items-center overflow-auto bg-black/40 p-3">
        <img src={url} alt={lesson.document_name ?? "image"} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(lower)) {
    return <video src={url} controls className="h-full w-full bg-black" />;
  }
  // Fallback: try iframe for HTML
  return <iframe src={url} className="h-full w-full" title={lesson.document_name ?? "document"} />;
}
