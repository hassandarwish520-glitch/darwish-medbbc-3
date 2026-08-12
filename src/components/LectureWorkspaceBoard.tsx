"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Save, PanelRightOpen, Sparkles } from "lucide-react";
import BlockEditor, { type Block } from "@/components/BlockEditor";

type Category = "subject" | "lecture" | "qbank" | "qbank-active" | "documents";

type WorkspaceRow = {
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

function inferCategory(lessonKind: string, title: string, hasVideo: boolean): Category {
  const kind = lessonKind.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (kind === "qbank" || lowerTitle.includes("qbank")) return hasVideo ? "qbank-active" : "qbank";
  if (kind === "video" || hasVideo) return "lecture";
  if (["html", "html-file", "html-inline", "pdf", "notes"].includes(kind)) return "lecture";
  return "documents";
}

function inferAttachmentBlock(url: string, name?: string | null): Pick<Block, "type" | "url" | "name" | "caption"> {
  const lowerUrl = url.toLowerCase();
  const lowerName = (name ?? "").toLowerCase();
  if (/\.pdf(?:$|[?#])/i.test(lowerUrl) || lowerName.endsWith(".pdf")) {
    return { type: "pdf", url, name: name ?? "Lecture PDF" };
  }
  if (
    /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(lowerUrl) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName) ||
    /\/image(?:$|[/?#])/i.test(lowerUrl)
  ) {
    return { type: "image", url, caption: name ?? "Lecture image" };
  }
  return { type: "attachment", url, name: name ?? "Lecture attachment" };
}

function makeInitialBlocks(args: {
  lessonTitle: string;
  lessonKind: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  videoUrl?: string | null;
}): Block[] {
  const blocks: Block[] = [
    { id: crypto.randomUUID(), type: "heading1", text: args.lessonTitle || "Lecture Workspace" },
    {
      id: crypto.randomUUID(),
      type: "callout",
      text:
        args.lessonKind === "video"
          ? "Teaching board for this video. Add explanations, screenshots, ECGs, algorithms, and high-yield notes here."
          : "Teaching board for this lecture. Add structured notes, tables, drawings, and attachments here.",
    },
  ];

  if (args.videoUrl && /(?:youtube\.com|youtu\.be)/i.test(args.videoUrl)) {
    blocks.push({ id: crypto.randomUUID(), type: "youtube", url: args.videoUrl, text: "Lecture video" } as Block);
  }
  if (args.attachmentUrl) {
    blocks.push({ id: crypto.randomUUID(), ...inferAttachmentBlock(args.attachmentUrl, args.attachmentName) } as Block);
  }

  blocks.push({ id: crypto.randomUUID(), type: "paragraph", text: "" });
  return blocks;
}

function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      if (block.type === "table" && Array.isArray(block.rows)) {
        return block.rows.map((row) => row.join(" | ")).join("\n");
      }
      return [block.text, block.caption, block.name].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 5000);
}

function currentPublishedValue(meta: Record<string, unknown> | null | undefined): boolean {
  const root = meta && typeof meta === "object" ? meta : {};
  const ws = (root as Record<string, unknown>).workspace;
  if (ws && typeof ws === "object" && typeof (ws as Record<string, unknown>).published === "boolean") {
    return (ws as Record<string, unknown>).published as boolean;
  }
  return typeof (root as Record<string, unknown>).published === "boolean"
    ? ((root as Record<string, unknown>).published as boolean)
    : false;
}

export default function LectureWorkspaceBoard({
  lessonId,
  lessonTitle,
  lessonKind,
  isAdmin = false,
  attachmentUrl,
  attachmentName,
  videoUrl,
}: {
  lessonId: string;
  lessonTitle: string;
  lessonKind: string;
  isAdmin?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  videoUrl?: string | null;
}) {
  const category = useMemo(() => inferCategory(lessonKind, lessonTitle, Boolean(videoUrl)), [lessonKind, lessonTitle, videoUrl]);
  const [workspace, setWorkspace] = useState<WorkspaceRow | null>(null);
  const [title, setTitle] = useState(lessonTitle);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces?lesson_id=${encodeURIComponent(lessonId)}&category=${encodeURIComponent(category)}&limit=20`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load workspace");
      const existing = Array.isArray(data?.workspaces) ? data.workspaces[0] : null;
      if (existing) {
        setWorkspace(existing);
        setTitle(existing.title || lessonTitle);
        setBlocks(Array.isArray(existing.blocks) && existing.blocks.length ? existing.blocks : makeInitialBlocks({ lessonTitle, lessonKind, attachmentUrl, attachmentName, videoUrl }));
        setPublished(currentPublishedValue(existing.meta));
        setSavedAt(existing.updated_at || null);
        setDirty(false);
      } else {
        const initialBlocks = makeInitialBlocks({ lessonTitle, lessonKind, attachmentUrl, attachmentName, videoUrl });
        const createRes = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            title: lessonTitle,
            lesson_id: lessonId,
            blocks: initialBlocks,
            legacy_body: blocksToPlainText(initialBlocks),
            meta: {
              source: lessonKind === "video" ? "video" : "lecture",
              original_file_url: attachmentUrl ?? null,
              original_file_name: attachmentName ?? null,
              video_url: videoUrl ?? null,
              published: false,
            },
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok) throw new Error(created?.error || "Failed to create workspace");
        setWorkspace(created.workspace);
        setTitle(created.workspace?.title || lessonTitle);
        setBlocks(initialBlocks);
        setPublished(false);
        setSavedAt(created.workspace?.updated_at || null);
        setDirty(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [attachmentName, attachmentUrl, category, lessonId, lessonKind, lessonTitle, videoUrl]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const saveWorkspace = useCallback(async () => {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workspace.id,
          lesson_id: lessonId,
          category,
          title,
          blocks,
          legacy_body: blocksToPlainText(blocks),
          meta: {
            ...(workspace.meta ?? {}),
            source: lessonKind === "video" ? "video" : "lecture",
            original_file_url: attachmentUrl ?? null,
            original_file_name: attachmentName ?? null,
            video_url: videoUrl ?? null,
            published: isAdmin ? published : currentPublishedValue(workspace.meta),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setWorkspace(data.workspace);
      setSavedAt(data.workspace?.updated_at || new Date().toISOString());
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [attachmentName, attachmentUrl, blocks, category, isAdmin, lessonId, lessonKind, published, title, videoUrl, workspace]);

  useEffect(() => {
    if (!dirty || !workspace) return;
    const timer = window.setTimeout(() => {
      void saveWorkspace();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, workspace, saveWorkspace]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        void saveWorkspace();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveWorkspace();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [saveWorkspace]);

  return (
    <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-[24px] border border-ink-800 bg-[#08111d] shadow-[0_18px_60px_rgba(3,7,18,0.4)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-800 bg-[#07101a] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
            <PanelRightOpen className="h-3.5 w-3.5" /> Lecture Workspace
          </div>
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
            className="mt-1 w-full bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
            placeholder="Workspace title"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{lessonKind === "video" ? "Video workspace" : "Teaching board"}</span>
            <span>•</span>
            <span>{saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Auto-save enabled"}</span>
          </div>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setPublished((value) => !value);
              setDirty(true);
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${published ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}
          >
            {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {published ? "Published" : "Private"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void saveWorkspace()}
          disabled={!workspace || saving}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save now
        </button>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center p-6 text-sm text-slate-400">
          <div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…</div>
        </div>
      ) : error ? (
        <div className="m-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      ) : workspace ? (
        <div className="flex-1 overflow-auto">
          <div className="border-b border-ink-800 bg-[#07101a] px-4 py-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              Block editor: headings, paragraphs, images, tables, checklist, callout, quote, code, divider, PDF, YouTube, links, and drawing.
            </span>
          </div>
          <BlockEditor
            key={workspace.id}
            initial={blocks}
            onChange={(nextBlocks) => {
              setBlocks(nextBlocks);
              setDirty(true);
            }}
            className="min-h-[52vh] bg-[#08111d]"
            storageKey={`lecture-workspace:${workspace.id}`}
          />
        </div>
      ) : null}
    </section>
  );
}
