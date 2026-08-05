import { createAdminClient } from "@/lib/supabase/server";
import CoursesAdmin from "./CoursesAdmin";
export default async function AdminCourses() {
  const admin = createAdminClient();
  const { data } = await admin.from("courses").select("*").order("created_at", { ascending:false });
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Courses</h1>
      <p className="text-slate-400 text-sm">Create and manage course tracks.</p>
      <CoursesAdmin initial={data ?? []} />
    </div>
  );
}
