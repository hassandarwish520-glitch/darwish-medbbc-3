import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LessonViewer from "@/components/LessonViewer";
import BookmarkButton from "@/components/BookmarkButton";

export default async function LessonPage({ params }: { params: { id: string } }) {
  const s = createClient();
  const { data: lesson } = await s.from("lessons").select("*").eq("id", params.id).single();
  if (!lesson || !lesson.visible) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs uppercase text-slate-500">{lesson.kind} lesson</div>
          <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
        </div>
        <BookmarkButton lessonId={lesson.id} />
      </div>

      <LessonViewer id={lesson.id} kind={lesson.kind} />
    </div>
  );
}
