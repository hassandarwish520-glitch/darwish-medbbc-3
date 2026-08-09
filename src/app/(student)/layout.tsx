import { redirect } from "next/navigation";
import { Clock3, ShieldCheck, UserRoundCheck } from "lucide-react";
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
        <div className="w-full max-w-lg rounded-[32px] border p-8 text-center" style={{ background: "var(--c-card)", borderColor: "rgba(52,211,153,0.16)", boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.16) 0%, rgba(52,211,153,0.05) 72%, transparent 73%)" }}>
            <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(16,185,129,0.14)", color: "#10b981" }}>
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <h2 className="mt-5 text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>Your account is under review</h2>
          <p className="mt-2 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
            Thank you for registering. Our team is reviewing your information to ensure secure access.
          </p>
          <div className="mt-6 space-y-3 text-left">
            {[
              { label: "Account review", state: "In progress", icon: UserRoundCheck },
              { label: "Eligibility verification", state: "Pending", icon: ShieldCheck },
              { label: "Access activation", state: "Pending", icon: Clock3 },
            ].map((item, index) => {
              const Icon = item.icon;
              const active = index === 0;
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)" }}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: active ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.10)", color: active ? "#10b981" : "#94a3b8" }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium" style={{ color: "var(--c-text-2)" }}>{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : "var(--c-text-4)" }}>{item.state}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl border px-4 py-4 text-left" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(148,163,184,0.12)" }}>
            <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>Why do we review accounts?</div>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--c-text-3)" }}>
              To protect the course content and prevent unauthorized sharing or misuse. This process usually takes 6–24 hours.
            </p>
          </div>
          <p className="mt-5 text-xs" style={{ color: "var(--c-text-4)" }}>Signed in as {ctx.profile?.email ?? ctx.user.email}</p>
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
