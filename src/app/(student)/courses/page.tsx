import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";

export default async function CoursesPage() {
  const s = await createClient();
  const { data: courses } = await s.from("courses").select("*").eq("visible", true).order("created_at");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold">Medical Training Courses</h1>
      <p className="text-slate-400 mt-1">Advance your medical career with expert-led courses.</p>

      {(!courses || !courses.length) ? (
        <div className="mt-16 text-center text-slate-400">
          <BookOpen className="h-10 w-10 mx-auto opacity-40" />
          <div className="mt-3">No courses yet</div>
          <div className="text-sm text-slate-500">An administrator will publish courses shortly.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {courses.map((c: any) => (
            <Link key={c.id} href={`/courses/${c.slug}`} className="card p-5 hover:border-brand transition">
              <div className="text-lg font-semibold">{c.title}</div>
              <p className="text-sm text-slate-400 mt-2 line-clamp-3">{c.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
