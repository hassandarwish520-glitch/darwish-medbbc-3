import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ProtectionGuards from "@/components/ProtectionGuards";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  if (!ctx) redirect("/sign-in");

  if (ctx.profile?.status === "pending") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold">Account pending activation</h2>
          <p className="text-slate-400 mt-2 leading-7">
            Your account was created successfully. An administrator will review and activate your access to the course content shortly.
          </p>
          <p className="text-slate-500 text-xs mt-4">Signed in as {ctx.profile?.email ?? ctx.user.email}</p>
        </div>
      </main>
    );
  }

  if (ctx.profile?.status === "suspended") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold">Account suspended</h2>
          <p className="text-slate-400 mt-2 leading-7">
            Your access is currently suspended. Please contact the administrator if you believe this is a mistake.
          </p>
          <p className="text-slate-500 text-xs mt-4">Signed in as {ctx.profile?.email ?? ctx.user.email}</p>
        </div>
      </main>
    );
  }

  return (
    <AppShell profile={ctx.profile}>
      <ProtectionGuards />
      {children}
    </AppShell>
  );
}
