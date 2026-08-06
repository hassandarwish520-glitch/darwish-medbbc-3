import { notFound } from "next/navigation";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import VideoPlayerClient from "./VideoPlayerClient";

export const dynamic = "force-dynamic";

function assetHref(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function parseVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireActive();
  if (!ctx) notFound();

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const db = canPreviewHidden ? createAdminClient() : await createClient();

  const { data: rawLesson } = await db
    .from("lessons")
    .select("id, title, kind, meta, course_id, visible")
    .eq("id", id)
    .single();

  type LessonRow = {
    id: string;
    title: string;
    kind: string;
    meta: unknown;
    course_id: string | null;
    visible: boolean | null;
  };

  const lesson = rawLesson as LessonRow | null;

  if (!lesson || (!lesson.visible && !canPreviewHidden)) notFound();

  const meta = (lesson.meta ?? null) as {
    type?: string;
    url?: string;
    provider?: string;
    document_path?: string;
    document_name?: string;
    document_mime?: string;
    notes?: string;
    index_text?: string;
  } | null;

  const rawUrl = meta?.url ?? "";
  const ytId = rawUrl ? parseYouTubeId(rawUrl) : null;
  const vimeoId = rawUrl ? parseVimeoId(rawUrl) : null;

  let embedUrl: string | null = null;
  let videoType: "youtube" | "vimeo" | "direct" | "none" = "none";

  if (ytId) {
    embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
    videoType = "youtube";
  } else if (vimeoId) {
    embedUrl = `https://player.vimeo.com/video/${vimeoId}?color=10b981&title=0&byline=0`;
    videoType = "vimeo";
  } else if (meta?.document_path) {
    embedUrl = assetHref(meta.document_path);
    videoType = "direct";
  } else if (rawUrl) {
    embedUrl = rawUrl;
    videoType = "direct";
  }

  // Fetch playlist — other lessons in same course
  let playlist: { id: string; title: string; kind: string; meta: unknown }[] = [];
  if (lesson.course_id) {
    const { data } = await db
      .from("lessons")
      .select("id, title, kind, meta")
      .eq("course_id", lesson.course_id)
      .eq("visible", true)
      .order("position", { ascending: true })
      .limit(30);
    playlist = ((data ?? []) as { id: string; title: string; kind: string; meta: unknown }[]).filter(
      (l) => l.meta && typeof l.meta === "object" && (l.meta as Record<string, unknown>).type === "video"
    );
  }

  // Fallback: if no course playlist, fetch latest videos
  if (playlist.length === 0) {
    const { data } = await db
      .from("lessons")
      .select("id, title, kind, meta")
      .eq("visible", true)
      .contains("meta", { type: "video" })
      .order("created_at", { ascending: false })
      .limit(15);
    playlist = (data ?? []) as { id: string; title: string; kind: string; meta: unknown }[];
  }

  const notes = typeof meta?.notes === "string" ? meta.notes : "";
  const transcript = typeof meta?.index_text === "string" ? meta.index_text : "";

  return (
    <VideoPlayerClient
      lesson={{ id: lesson.id, title: lesson.title, kind: lesson.kind }}
      embedUrl={embedUrl}
      videoType={videoType}
      playlist={playlist.map((p) => ({
        id: p.id,
        title: p.title,
        active: p.id === lesson.id,
      }))}
      initialNotes={notes}
      transcript={transcript}
      attachmentUrl={meta?.document_path ? assetHref(meta.document_path) : null}
      attachmentName={meta?.document_name ?? null}
    />
  );
}
