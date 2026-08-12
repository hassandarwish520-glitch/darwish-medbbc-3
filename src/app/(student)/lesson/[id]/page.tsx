import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, PlaySquare } from "lucide-react";
import BookmarkButton from "@/components/BookmarkButton";
import StudyWorkspace from "@/components/StudyWorkspace";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LessonMeta = {
  type?: string;
  provider?: string;
  notes?: string;
  index_text?: string;
  document_path?: string;
  document_name?: string;
  document_mime?: string;
  original_name?: string;
  file_type?: string;
  url?: string;
  telegram_links?: unknown;
  quality_links?: unknown;
  qualities?: unknown;
  downloads?: unknown;
  materials?: unknown;
  attachments?: unknown;
  files?: unknown;
  clinical_images?: unknown;
} | null;

type PlaylistItem = { id: string; title: string; active: boolean };
type TelegramLink = { label: string; url: string; resolution?: string | null; size?: string | null };
type MaterialItem = { label: string; url: string; kind: string; mime?: string | null };

function prettifyLessonTitle(raw: string) {
  const cleaned = raw
    .replace(/\.(html|htm|pdf|docx?|pptx?)$/i, "")
    .replace(/^cardio_block_(\d+)_?\d*q?$/i, "Cardio QBank Block $1")
    .replace(/^([a-z]+)_block_(\d+)_?\d*q?$/i, (_, subject: string, n: string) => `${subject} QBank Block ${n}`)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function assetHref(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/api/")) return trimmed;
  return assetHref(trimmed.replace(/^\/+/, ""));
}

function inferResolution(label: string | null, url: string): string | null {
  const text = `${label ?? ""} ${url}`;
  const match = text.match(/\b(360|480|540|720|1080|1440|2160)p\b/i);
  return match ? `${match[1]}p` : null;
}

function extractTelegramLinks(meta: LessonMeta, provider: string, rawUrl: string): TelegramLink[] {
  const results: TelegramLink[] = [];
  const seen = new Set<string>();

  const pushLink = (labelHint: string | null, raw: unknown) => {
    if (typeof raw === "string") {
      const url = normalizeUrl(raw);
      if (!url) return;
      const label = labelHint?.trim() || inferResolution(null, url) || "Telegram";
      const key = `${label}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ label, url, resolution: inferResolution(label, url), size: null });
      return;
    }

    if (Array.isArray(raw)) {
      raw.forEach((item) => pushLink(labelHint, item));
      return;
    }

    if (isRecord(raw)) {
      const directUrl = normalizeUrl(raw.url ?? raw.href ?? raw.link ?? raw.telegram_url);
      if (directUrl) {
        const label = pickString(raw.label, raw.quality, raw.resolution, labelHint) ?? inferResolution(labelHint, directUrl) ?? "Telegram";
        const key = `${label}|${directUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            label,
            url: directUrl,
            resolution: pickString(raw.resolution, raw.quality) ?? inferResolution(label, directUrl),
            size: pickString(raw.size, raw.file_size, raw.estimated_size),
          });
        }
        return;
      }
      Object.entries(raw).forEach(([key, value]) => pushLink(key, value));
    }
  };

  [meta?.telegram_links, meta?.quality_links, meta?.qualities, meta?.downloads].forEach((source) => pushLink(null, source));

  if (results.length === 0 && provider === "telegram") {
    const fallback = normalizeUrl(rawUrl);
    if (fallback) {
      results.push({
        label: inferResolution("Telegram", fallback) ?? "Telegram",
        url: fallback,
        resolution: inferResolution("Telegram", fallback),
        size: null,
      });
    }
  }

  return results;
}

function extractMaterials(meta: LessonMeta): MaterialItem[] {
  const results: MaterialItem[] = [];
  const seen = new Set<string>();

  const pushMaterial = (labelHint: string | null, raw: unknown, kindHint = "Material") => {
    if (typeof raw === "string") {
      const url = normalizeUrl(raw);
      if (!url) return;
      const label = labelHint?.trim() || kindHint;
      const key = `${label}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ label, url, kind: kindHint, mime: null });
      return;
    }

    if (Array.isArray(raw)) {
      raw.forEach((item) => pushMaterial(labelHint, item, kindHint));
      return;
    }

    if (isRecord(raw)) {
      const directUrl = normalizeUrl(raw.url ?? raw.href ?? raw.link ?? raw.path ?? raw.document_path);
      if (directUrl) {
        const label = pickString(raw.label, raw.name, raw.title, labelHint) ?? kindHint;
        const kind = pickString(raw.kind, raw.type, raw.category) ?? kindHint;
        const key = `${label}|${directUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ label, url: directUrl, kind, mime: pickString(raw.mime, raw.content_type) });
        }
        return;
      }
      Object.entries(raw).forEach(([key, value]) => pushMaterial(key, value, kindHint));
    }
  };

  if (meta?.document_path) {
    pushMaterial(meta.document_name ?? "Lecture attachment", meta.document_path, "Lecture Material");
  }
  pushMaterial(null, meta?.materials, "Lecture Material");
  pushMaterial(null, meta?.attachments, "Attachment");
  pushMaterial(null, meta?.files, "Additional File");
  pushMaterial("Clinical Image", meta?.clinical_images, "Clinical Image");

  return results;
}

function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

function resolveVideoSource(meta: LessonMeta) {
  const rawUrl = typeof meta?.url === "string" ? meta.url.trim() : "";
  const ytId = rawUrl ? parseYouTubeId(rawUrl) : null;
  const vimeoId = rawUrl ? parseVimeoId(rawUrl) : null;

  if (ytId) {
    return {
      sessionUrl: rawUrl,
      sessionEmbedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`,
      videoType: "youtube" as const,
    };
  }

  if (vimeoId) {
    return {
      sessionUrl: rawUrl,
      sessionEmbedUrl: `https://player.vimeo.com/video/${vimeoId}?color=10b981&title=0&byline=0`,
      videoType: "vimeo" as const,
    };
  }

  if (rawUrl) {
    return {
      sessionUrl: rawUrl,
      sessionEmbedUrl: rawUrl,
      videoType: "direct" as const,
    };
  }

  if (meta?.document_path && (meta.document_mime || "").startsWith("video/")) {
    const href = assetHref(meta.document_path);
    return {
      sessionUrl: href,
      sessionEmbedUrl: href,
      videoType: "direct" as const,
    };
  }

  return {
    sessionUrl: rawUrl || null,
    sessionEmbedUrl: null,
    videoType: "none" as const,
  };
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireActive();
  if (!ctx) notFound();

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const db = canPreviewHidden ? createAdminClient() : await createClient();
  const { data: lesson } = await db.from("lessons").select("*").eq("id", id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) notFound();

  const meta = (lesson.meta ?? null) as LessonMeta;
  const isVideo = meta?.type === "video";
  const provider = typeof meta?.provider === "string" ? meta.provider : "";
  const { sessionUrl, sessionEmbedUrl, videoType } = resolveVideoSource(meta);
  const telegramLinks = extractTelegramLinks(meta, provider, sessionUrl ?? "");
  const materials = extractMaterials(meta);

  let playlist: PlaylistItem[] = [];
  if (isVideo && lesson.course_id) {
    const { data } = await db
      .from("lessons")
      .select("id, title, kind, meta")
      .eq("course_id", lesson.course_id)
      .eq("visible", true)
      .order("position", { ascending: true })
      .limit(60);

    playlist = ((data ?? []) as { id: string; title: string; kind: string; meta: unknown }[])
      .filter((row) => row.meta && typeof row.meta === "object" && (row.meta as Record<string, unknown>).type === "video")
      .map((row) => ({ id: row.id, title: row.title, active: row.id === lesson.id }));
  }

  const displayTitle = prettifyLessonTitle(lesson.title);
  const inferredAttachmentMime =
    meta?.document_mime ||
    (meta?.file_type === "image" ? "image/*" : lesson.kind === "pdf" ? "application/pdf" : lesson.kind === "html" ? "text/html" : "");
  const inferredAttachmentName = meta?.document_name || meta?.original_name || displayTitle || "Attached file";

  return (
    <div className="page-shell max-w-5xl pb-10">
      <Link
        href={isVideo ? "/videos" : "/courses"}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <section className="card mt-4 overflow-hidden border-ink-800 bg-ink-900">
        <div className={`h-1.5 w-full ${isVideo ? "bg-gradient-to-r from-fuchsia-500 via-brand to-cyan-400" : "bg-gradient-to-r from-cyan-500 via-brand to-emerald-400"}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-ink-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {isVideo ? "Video session" : `${lesson.kind} lesson`}
                </span>
                {provider ? (
                  <span className="rounded-full border border-ink-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {provider}
                  </span>
                ) : null}
                {!lesson.visible && canPreviewHidden ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300">
                    Hidden preview
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">{displayTitle}</h1>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="btn-ghost text-sm">
                  {isVideo ? <PlaySquare className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  Internal lesson view only
                </div>
              </div>
            </div>

            <BookmarkButton lessonId={lesson.id} />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <StudyWorkspace
          lessonId={lesson.id}
          lessonTitle={displayTitle}
          lessonKind={lesson.kind}
          lessonMeta={(lesson.meta ?? null) as Record<string, unknown> | null}
          subjectSlug={typeof (lesson.meta as Record<string, unknown> | null)?.subject === "string" ? ((lesson.meta as Record<string, unknown>).subject as string) : null}
          externalAttachment={meta?.document_path ? {
            href: assetHref(meta.document_path),
            mime: inferredAttachmentMime,
            name: inferredAttachmentName,
          } : null}
          sessionUrl={sessionUrl || null}
          sessionEmbedUrl={sessionEmbedUrl}
          videoType={videoType}
          provider={provider || null}
          telegramLinks={telegramLinks}
          materials={materials}
          playlist={playlist}
          playlistScopeKey={lesson.course_id ?? lesson.id}
          isAdmin={canPreviewHidden}
        />
      </section>
    </div>
  );
}
