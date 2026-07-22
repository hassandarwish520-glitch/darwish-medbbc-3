import { createAdminClient } from "@/lib/supabase/server";
import StudentsTable from "./StudentsTable";

export default async function AdminStudents() {
  const admin = createAdminClient();
  const { data: students } = await admin.from("profiles")
    .select("id,email,full_name,institution,role,status,created_at,activated_at")
    .order("created_at", { ascending: false });
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Students</h1>
      <p className="text-slate-400 text-sm">Manage student accounts and access.</p>
      <StudentsTable initial={students ?? []} />
    </div>
  );
}
