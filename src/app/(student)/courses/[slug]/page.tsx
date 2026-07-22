import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileText, FileType2, Layers, HelpCircle } from "lucide-react";

const ICON: any = { html: FileText, pdf: FileType2, flashcards: Layers, qbank: HelpCircle };

export default async function CourseDetail({ params }: { params: { slug: string } }) {
  const s = createClient();
  const { data: course } = await s.from("courses").select("*").eq("slug", params.slug).single();
  if (!course) notFound();

  const { data: subjects } = await s.from("subjects").select("id,title,position").eq("course_id", course.id).order("position");
  const { data: lessons }  = await s.from("lessons").select("id,title,kind,topic_id,course_id,position").eq("course_id", course.id).eq("visible", true).order("position");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold">{course.title}</h1>
      <p className="text-slate-400 mt-1">{course.description}</p>

      <div className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Lessons</h2>
        {(lessons ?? []).length === 0 && <p className="text-slate-500 text-sm">No lessons yet.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {(lessons ?? []).map(l => {
            const I = ICON[l.kind] ?? FileText;
            return (
              <Link key={l.id} href={`/lesson/${l.id}`}
                className="card p-4 flex items-center gap-3 hover:border-brand transition">
                <I className="h-5 w-5 text-brand" />
                <div>
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-slate-500 uppercase">{l.kind}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <h2 className="text-lg font-semibold mt-6">Subjects</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(subjects ?? []).map(sb => (
            <div key={sb.id} className="card p-4">{sb.title}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
