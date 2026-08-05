import { createAdminClient } from "@/lib/supabase/server";
import StudentsTable from "./StudentsTable";

function inferRole(email: string | null | undefined, metaRole: unknown, fallbackRole: string | null | undefined) {
  if (fallbackRole) return fallbackRole;
  if (email === "hassandarwish520@gmail.com") return "admin";
  const raw = typeof metaRole === "string" ? metaRole.toLowerCase().trim() : "";
  if (raw === "educator" || raw === "instructor") return "educator";
  if (raw === "admin") return "admin";
  return "student";
}

export default async function AdminStudents() {
  const admin = createAdminClient();
  const [{ data: students }, { data: authUsers }] = await Promise.all([
    admin.from("profiles")
      .select("id,email,full_name,institution,role,status,created_at,activated_at")
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profileMap = new Map((students ?? []).map((row) => [row.id, row]));
  const rows = (authUsers?.users ?? []).map((user) => {
    const profile = profileMap.get(user.id);
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return {
      id: user.id,
      email: profile?.email ?? user.email ?? "—",
      full_name: profile?.full_name ?? (typeof meta.full_name === "string" ? meta.full_name : null),
      institution: profile?.institution ?? (typeof meta.institution === "string" ? meta.institution : null),
      role: inferRole(user.email, meta.role, profile?.role),
      status: profile?.status ?? (user.email === "hassandarwish520@gmail.com" ? "active" : "pending"),
      created_at: profile?.created_at ?? user.created_at ?? new Date().toISOString(),
      activated_at: profile?.activated_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? user.confirmed_at ?? null,
    };
  });

  const missingOnlyProfiles = (students ?? []).filter((row) => !(authUsers?.users ?? []).some((user) => user.id === row.id)).map((row) => ({
    ...row,
    email_confirmed_at: null,
  }));

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Students</h1>
      <p className="text-slate-400 text-sm">Manage student and instructor accounts, activation status, and access.</p>
      <StudentsTable initial={[...rows, ...missingOnlyProfiles]} />
    </div>
  );
}
