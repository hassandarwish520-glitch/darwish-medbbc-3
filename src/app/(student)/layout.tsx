import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AITutor from "@/components/AITutor";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  if (!ctx) redirect("/sign-in");
  if (ctx.profile?.status === "pending") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold">Account pending activation</h2>
          <p className="text-slate-400 mt-2">
            An administrator must activate your account before you can access the platform.
          </p>
          <p className="text-slate-500 text-xs mt-4">Signed in as {ctx.profile.email}</p>
        </div>
      </main>
    );
  }
  return (
    <AppShell profile={ctx.profile}>
      {children}
      <AITutor />
    </AppShell>
  );
}
