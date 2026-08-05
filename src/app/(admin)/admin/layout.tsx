import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, isAdminProfile } from "@/lib/supabase/server";
import { Users, FileText, HelpCircle, Layers, Video, BookOpen, Brain, MessageSquare, Shield, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();

  if (!ctx) {
    redirect("/sign-in");
  }

  if (!isAdminProfile(ctx.profile)) {
    redirect("/dashboard");
  }

  const nav = [
    { href: "/admin", label: "Students", icon: Users },
    { href: "/admin/courses", label: "Courses", icon: BookOpen },
    { href: "/admin/documents", label: "Documents", icon: FileText },
    { href: "/admin/qbank", label: "QBank", icon: HelpCircle },
    { href: "/admin/collections", label: "Collections", icon: Package },
    { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    { href: "/admin/flashcards", label: "Flashcards", icon: Layers },
    { href: "/admin/videos", label: "Videos", icon: Video },
    { href: "/admin/ai", label: "AI Studio", icon: Brain },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--c-bg)", color: "var(--c-text-1)" }}>
      <aside
        className="w-60 shrink-0 border-r p-4 flex flex-col gap-2"
        style={{ background: "var(--c-sidebar-bg)", borderColor: "var(--c-border)" }}
      >
        <div className="flex items-center gap-2 mb-5 px-2">
          <div
            className="h-9 w-9 rounded-xl grid place-items-center text-brand"
            style={{ background: "var(--c-brand-bg)" }}
          >
            <Shield className="h-4 w-4" />
          </div>
          <div className="font-bold text-sm" style={{ color: "var(--c-text-1)" }}>MedBBC Admin</div>
        </div>
        <nav className="space-y-0.5 text-sm">
          {nav.map((n) => {
            const I = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{ color: "var(--c-text-2)" }}
              >
                <I className="h-4 w-4 shrink-0" style={{ color: "var(--c-text-3)" }} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0" style={{ background: "var(--c-bg)" }}>
        {children}
      </main>
    </div>
  );
}
