import DocumentsClient from "./DocumentsClient";
import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminDocuments() {
  const admin = createAdminClient();
  const [{ data: lessons }, { data: courses }, { data: configSubjects }, { data: lessonSubjects }] = await Promise.all([
    admin
      .from("lessons")
      .select("id,title,kind,visible,course_id,created_at,meta")
      .in("kind", ["html", "pdf"])
      .order("created_at", { ascending: false }),
    admin.from("courses").select("id,title").order("title"),
    admin
      .from("exam_subject_configs")
      .select("subject_title,position")
      .eq("exam_code", "IFOM_CSE")
      .eq("is_active", true)
      .order("position"),
    // Also pull subjects already tagged on existing lessons (as fallback)
    admin
      .from("lessons")
      .select("meta")
      .not("meta->>subject", "is", null),
  ]);

  // Build subject list: from exam config + from existing lesson meta.subject
  const fromConfig = (configSubjects ?? []).map((row: any) => row.subject_title as string).filter(Boolean);
  const fromLessons = (lessonSubjects ?? [])
    .map((row: any) => typeof row.meta?.subject === "string" ? row.meta.subject.trim() : "")
    .filter(Boolean);

  const allSubjects = Array.from(
    new Set([
      ...fromConfig,
      ...fromLessons,
      "NBME",
      "CMS",
      "General Quizzes",
    ])
  ).sort();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Documents</h1>
      <p className="text-slate-400 text-sm mt-1">
        Upload or organize study documents, assign each one to a main subject, and control whether it appears under Notes or Active Q-Bank.
      </p>
      <DocumentsClient
        initial={lessons ?? []}
        courses={courses ?? []}
        subjects={allSubjects}
      />
    </div>
  );
}
