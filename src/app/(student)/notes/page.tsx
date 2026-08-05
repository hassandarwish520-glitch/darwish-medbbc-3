import { createClient, requireUser, createAdminClient } from "@/lib/supabase/server";
import NotesClient from "./NotesClient";

export const dynamic = "force-dynamic";

type RawNote = {
  id: string;
  body: string;
  meta: { title?: string | null } | null;
  lesson_id: string | null;
  updated_at: string;
  lessons:
    | {
        id: string;
        title: string;
        course_id: string | null;
        courses: { id: string; title: string } | null;
      }
    | null;
};

export default async function NotesPage() {
  const ctx = await requireUser();
  const s = await createClient();
  const admin = createAdminClient();

  const [{ data: notes }, { data: lessons }] = await Promise.all([
    s
      .from("notes")
      .select("id, body, meta, lesson_id, updated_at, lessons(id,title,course_id,courses(id,title))")
      .eq("user_id", ctx!.user.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("lessons")
      .select("id, title, kind, course_id, courses(id, title)")
      .in("kind", ["html", "html-file", "html-inline", "pdf"])
      .eq("visible", true)
      .order("title")
      .limit(200),
  ]);

  const formatted = ((notes ?? []) as unknown as RawNote[]).map((n) => ({
    id: n.id,
    body: n.body,
    title: n.meta?.title ?? null,
    lesson_id: n.lesson_id ?? null,
    lesson_title: n.lessons?.title ?? null,
    course_id: n.lessons?.course_id ?? n.lessons?.courses?.id ?? null,
    course_title: n.lessons?.courses?.title ?? null,
    updated_at: n.updated_at,
    image_paths: (n.meta as { image_paths?: string[] } | null)?.image_paths ?? [],
  }));

  const formattedLessons = (lessons ?? []).map((l: any) => ({
    id: l.id as string,
    title: l.title as string,
    kind: l.kind as string,
    course_id: (l.course_id as string | null) ?? null,
    course_title: (l.courses?.title as string | null) ?? null,
  }));

  return (
    <div className="page-shell">
      <h1 className="section-title text-3xl">Notes</h1>
      <p className="mt-2 text-lg text-slate-400">
        Add notes manually, import from a file, or pull directly from any course document.
      </p>
      <NotesClient initial={formatted} lessons={formattedLessons} />
    </div>
  );
}
