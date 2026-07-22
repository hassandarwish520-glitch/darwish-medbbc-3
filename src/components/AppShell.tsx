"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, BookOpen, Layers, HelpCircle, Bookmark,
  BarChart3, Settings, LogOut, Stethoscope, Shield,
} from "lucide-react";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",     icon: LayoutDashboard, group: "STUDY" },
  { href: "/courses",    label: "Courses",       icon: BookOpen,        group: "STUDY" },
  { href: "/flashcards", label: "Flashcards",    icon: Layers,          group: "STUDY" },
  { href: "/qbank",      label: "Question Bank", icon: HelpCircle,      group: "STUDY" },
  { href: "/bookmarks",  label: "Bookmarks",     icon: Bookmark,        group: "LIBRARY" },
  { href: "/progress",   label: "My Progress",   icon: BarChart3,       group: "LIBRARY" },
  { href: "/settings",   label: "Settings",      icon: Settings,        group: "ACCOUNT" },
];

export default function AppShell({
  children, profile,
}: { children: React.ReactNode; profile: { full_name?: string | null; role?: string | null; email?: string | null } | null }) {
  const path = usePathname();
  const router = useRouter();
  const groups = Array.from(new Set(NAV.map(n => n.group)));
  const isAdmin = profile?.role === "admin";

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/sign-in");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col bg-ink-900 border-r border-ink-700 p-4">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <Stethoscope className="h-5 w-5 text-brand" />
          <span className="font-bold text-brand">DarwishMedBBC</span>
        </Link>
        <div className="mt-2 px-3 py-1 rounded-full bg-ink-800 border border-ink-700 text-xs text-slate-300 w-fit">
          {isAdmin ? "◈ Admin" : "◇ Student"}
        </div>

        <nav className="mt-6 flex-1 space-y-4 text-sm">
          {groups.map(g => (
            <div key={g}>
              <div className="label px-2 mb-1">{g}</div>
              {NAV.filter(n => n.group === g).map(n => {
                const A = n.icon;
                const active = path === n.href || path.startsWith(n.href + "/");
                return (
                  <Link key={n.href} href={n.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${active ? "bg-ink-800 text-white" : "text-slate-400 hover:bg-ink-800/60"}`}>
                    <A className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </div>
          ))}

          {isAdmin && (
            <div>
              <div className="label px-2 mb-1">ADMIN</div>
              <Link href="/admin"
                className={`flex items-center gap-3 px-3 py-2 rounded-xl ${path.startsWith("/admin") ? "bg-brand/20 text-brand" : "text-slate-400 hover:bg-ink-800/60"}`}>
                <Shield className="h-4 w-4" /> Admin Panel
              </Link>
            </div>
          )}
        </nav>

        <button onClick={signOut}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:bg-ink-800">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
