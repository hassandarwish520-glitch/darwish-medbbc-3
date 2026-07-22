import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, isAdminProfile } from "@/lib/supabase/server";
import { Users, FileText, HelpCircle, Layers, Video, BookOpen, Brain } from "lucide-react";

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
    { href: "/admin/flashcards", label: "Flashcards", icon: Layers },
    { href: "/admin/videos", label: "Videos", icon: Video },
    { href: "/admin/ai", label: "AI Studio", icon: Brain },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-ink-900 border-r border-ink-700 p-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-brand/20 grid place-items-center text-brand">◉</div>
          <div className="font-bold">MedBBC Admin</div>
        </div>
        <nav className="space-y-1 text-sm">
          {nav.map((n) => {
            const I = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-300 hover:bg-ink-800"
              >
                <I className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
