import DocumentsClient from "./DocumentsClient";
import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminDocuments() {
  const admin = createAdminClient();
  const { data: lessons } = await admin.from("lessons")
    .select("id,title,kind,visible,course_id,created_at,meta")
    .in("kind", ["html","pdf"])
    .order("created_at", { ascending: false });
  const { data: courses } = await admin.from("courses").select("id,title").order("title");
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Documents</h1>
      <p className="text-slate-400 text-sm">Upload files or create HTML study pages.</p>
      <DocumentsClient initial={lessons ?? []} courses={courses ?? []} />
    </div>
  );
}
