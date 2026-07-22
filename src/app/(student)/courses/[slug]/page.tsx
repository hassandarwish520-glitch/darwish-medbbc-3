import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileText, FileType2, HelpCircle, Layers, Video } from "lucide-react";

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  meta?: { type?: string } | null;
  topic_id?: string | null;
  course_id?: string | null;
  position?: number;
};

const ICON = {
  html: FileText,
  pdf: FileType2,
  flashcards: Layers,
  qbank: HelpCircle,
  video: Video,
} as const;

export default async function CourseDetail({ params }: { params: { slug: string } }) {
  const s = createClient();
  const { data: course } = await s.from("courses").select("*").eq("slug", params.slug).single();
  if (!course) notFound();

  const [{ data: subjects }, { data: lessons }] = await Promise.all([
    s.from("subjects").select("id,title,position").eq("course_id", course.id).order("position"),
    s.from("lessons").select("id,title,kind,meta,topic_id,course_id,position").eq("course_id", course.id).eq("visible", true).order("position"),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold">{course.title}</h1>
      <p className="text-slate-400 mt-1">{course.description}</p>

      <div className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Lessons</h2>
        {(lessons ?? []).length === 0 && <p className="text-slate-500 text-sm">No lessons yet.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {(lessons ?? []).map((lesson: LessonRow) => {
            const isVideo = lesson.meta?.type === "video";
            const Icon = isVideo ? ICON.video : ICON[lesson.kind as keyof typeof ICON] ?? FileText;
            const label = isVideo ? "video session" : `${lesson.kind} lesson`;
            return (
              <Link
                key={lesson.id}
                href={`/lesson/${lesson.id}`}
                className="card p-4 flex items-center gap-3 hover:border-brand transition"
              >
                <Icon className="h-5 w-5 text-brand" />
                <div>
                  <div className="font-medium">{lesson.title}</div>
                  <div className="text-xs text-slate-500 uppercase">{label}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <h2 className="text-lg font-semibold mt-6">Subjects</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(subjects ?? []).map((subject) => (
            <div key={subject.id} className="card p-4">
              {subject.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
