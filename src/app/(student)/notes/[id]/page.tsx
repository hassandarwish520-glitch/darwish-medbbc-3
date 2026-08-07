import { notFound } from "next/navigation";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import NotesViewerClient from "./NotesViewerClient";

export const dynamic = "force-dynamic";

function assetHref(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export default async function NotesViewerPage({
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
    document_path?: string;
    document_name?: string;
    document_mime?: string;
    url?: string;
  } | null;

  const pdfUrl = meta?.document_path ? assetHref(meta.document_path) : null;
  const documentName = meta?.document_name ?? lesson.title;

  let courseTitle: string | null = null;
  if (lesson.course_id) {
    const { data: course } = await db
      .from("courses")
      .select("title")
      .eq("id", lesson.course_id)
      .single();
    courseTitle = (course as { title?: string | null } | null)?.title ?? null;
  }

  // Fetch sibling lessons for outline context
  let siblingLessons: { id: string; title: string; kind: string }[] = [];
  if (lesson.course_id) {
    const { data } = await db
      .from("lessons")
      .select("id, title, kind")
      .eq("course_id", lesson.course_id)
      .eq("visible", true)
      .order("position", { ascending: true })
      .limit(20);
    siblingLessons = (data ?? []) as { id: string; title: string; kind: string }[];
  }

  return (
    <NotesViewerClient
      lesson={{
        id: lesson.id,
        title: lesson.title,
        kind: lesson.kind,
        documentName,
        courseTitle,
      }}
      pdfUrl={pdfUrl}
      siblings={siblingLessons}
    />
  );
}
