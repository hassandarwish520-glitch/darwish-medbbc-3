import { notFound } from "next/navigation";
import BookmarkButton from "@/components/BookmarkButton";
import LessonViewer from "@/components/LessonViewer";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export default async function LessonPage({ params }: { params: { id: string } }) {
  const ctx = await requireActive();
  if (!ctx) notFound();

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const db = canPreviewHidden ? createAdminClient() : createClient();
  const { data: lesson } = await db.from("lessons").select("*").eq("id", params.id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) notFound();

  const isVideo = lesson.meta?.type === "video";
  const lessonLabel = isVideo ? "video session" : `${lesson.kind} lesson`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs uppercase text-slate-500">{lessonLabel}</div>
          <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
          {isVideo && lesson.meta?.provider && (
            <div className="text-sm text-slate-400 mt-1">Provider: {String(lesson.meta.provider)}</div>
          )}
          {!lesson.visible && canPreviewHidden && (
            <div className="mt-2 inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">
              Hidden item preview (admin only)
            </div>
          )}
        </div>
        <BookmarkButton lessonId={lesson.id} />
      </div>

      <LessonViewer id={lesson.id} kind={lesson.kind} />
    </div>
  );
}
