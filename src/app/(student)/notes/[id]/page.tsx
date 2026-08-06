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

  const { data: lesson } = await db
    .from("lessons")
    .select("id, title, kind, meta, course_id, visible")
    .eq("id", id)
    .single();

  const lessonVisible = (lesson as typeof lesson & { visible?: boolean | null });
  if (!lessonVisible || (!lessonVisible.visible && !canPreviewHidden)) notFound();

  const meta = (lesson.meta ?? null) as {
    document_path?: string;
    document_name?: string;
    document_mime?: string;
    url?: string;
  } | null;

  const pdfUrl = meta?.document_path ? assetHref(meta.document_path) : null;
  const documentName = meta?.document_name ?? lesson.title;

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
    siblingLessons = data ?? [];
  }

  return (
    <NotesViewerClient
      lesson={{
        id: lesson.id,
        title: lesson.title,
        kind: lesson.kind,
        documentName,
      }}
      pdfUrl={pdfUrl}
      siblings={siblingLessons}
    />
  );
}
