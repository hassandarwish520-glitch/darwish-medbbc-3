"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DeviceRegistrationGuard from "@/components/DeviceRegistrationGuard";
import {
  BarChart2,
  Bell,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  Files,
  FlaskConical,
  GraduationCap,
  HardDriveDownload,
  Layers,
  LayoutDashboard,
  Library,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  PlaySquare,
  Search,
  Shield,
  Stethoscope,
  Sun,
  User,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/qbank", label: "Q-Bank", icon: BookOpen },
  { href: "/collections", label: "Collections", icon: Package },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/videos", label: "Videos", icon: PlaySquare },
  { href: "/downloads", label: "Downloads", icon: HardDriveDownload },
  { href: "/knowledge", label: "Library", icon: Library },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/progress", label: "Progress", icon: BarChart2 },
  { href: "/ifom", label: "IFOM", icon: BookOpenCheck },
  { href: "/ifom-library", label: "IFOM Lib", icon: FlaskConical },
  { href: "/settings", label: "Profile", icon: User },
] as const;

const MOBILE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/qbank", label: "Q-Bank", icon: BookOpen },
  { href: "/videos", label: "Videos", icon: PlaySquare },
  { href: "/downloads", label: "Downloads", icon: HardDriveDownload },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/knowledge", label: "Library", icon: Library },
  { href: "/documents", label: "Documents", icon: Files },
] as const;

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export default function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: { full_name?: string | null; role?: string | null; email?: string | null } | null;
}) {
  const path = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = profile?.role === "admin";
  const isQbankSession = path === "/qbank" && (Boolean(searchParams.get("subject")) || Boolean(searchParams.get("block")));
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [notificationCount, setNotificationCount] = useState(0);
  const [isDark, setIsDark] = useState(true);
  // FIX: Track last fetch time so we don't hammer the API on every navigation.
  const lastFetchRef = useRef<number>(0);
  const NOTIFICATION_INTERVAL_MS = 60_000; // fetch at most once per minute

  useEffect(() => {
    const saved = localStorage.getItem("medbbc-theme");
    const dark = saved !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    setSearchValue(searchParams.get("q") || "");
  }, [searchParams]);

  // FIX: Fetch notifications on mount and then on a 60-second interval.
  // Previously this fired on every `path` change, triggering a heavy API call
  // (5–8 Supabase queries) on every single navigation.
  useEffect(() => {
    let cancelled = false;

    function fetchNotifications() {
      const now = Date.now();
      if (now - lastFetchRef.current < NOTIFICATION_INTERVAL_MS) return;
      lastFetchRef.current = now;

      fetch("/api/notifications/summary")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setNotificationCount(Number(data?.unread_count || 0));
        })
        .catch(() => {
          if (!cancelled) setNotificationCount(0);
        });
    }

    // Fetch immediately on mount.
    fetchNotifications();

    // Then poll every minute.
    const intervalId = setInterval(fetchNotifications, NOTIFICATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("medbbc-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = searchValue.trim();
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--c-bg)", color: "var(--c-text-1)" }}
    >
      <DeviceRegistrationGuard />
      {/* ── Top Header ── */}
      <header
        className={`glass-bar sticky top-0 z-30 ${isQbankSession ? "hidden md:block" : ""}`}
        style={{ background: "var(--c-header-bg)", borderBottomColor: "var(--c-border)" }}
      >
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">

          {/* Desktop: Logo */}
          <Link href="/dashboard" className="hidden items-center gap-3 md:flex shrink-0">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
            >
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div
                className="text-sm font-bold tracking-tight"
                style={{ color: "var(--c-text-1)" }}
              >
                MedQBank
              </div>
              <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--c-brand)" }}>
                Clinical precision
              </div>
            </div>
          </Link>

          {/* Search */}
          <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--c-text-4)" }}
            />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search qbank, notes, flashcards..."
              className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition"
              style={{
                borderColor: "var(--c-input-border)",
                background: "var(--c-input-bg)",
                color: "var(--c-text-1)",
              }}
            />
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="grid h-9 w-9 place-items-center rounded-xl border transition"
              style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAdmin && (
              <Link
                href="/admin"
                className="hidden rounded-xl border px-3 py-1.5 text-xs font-semibold md:inline-flex transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-brand)" }}
              >
                Admin
              </Link>
            )}

            <Link
              href="/notifications"
              className="relative grid h-9 w-9 place-items-center rounded-xl border transition"
              style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}
            >
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && (
                <span
                  className="absolute right-1 top-1 min-w-[16px] rounded-full px-1 text-center text-[9px] font-bold"
                  style={{ background: "var(--c-blue)", color: "#fff" }}
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-5 px-0 md:px-5">

        {/* ── Desktop Sidebar ── */}
        <aside
          className="sticky top-[60px] hidden max-h-[calc(100vh-60px)] w-[72px] shrink-0 overflow-y-auto border-r py-4 pr-3 md:flex md:flex-col md:items-center md:gap-0.5"
          style={{ borderColor: "var(--c-border)", background: "var(--c-sidebar-bg)" }}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className="flex w-full flex-col items-center gap-1 rounded-xl p-2.5 text-[10px] transition-all"
                style={active ? {
                  background: "var(--c-brand-bg)",
                  color: "var(--c-brand)",
                } : {
                  color: "var(--c-text-4)",
                }}
              >
                <Icon className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
                <span className="mt-0.5 text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              title="Admin"
              className="flex w-full flex-col items-center gap-1 rounded-xl p-2.5 text-[10px] transition-all"
              style={isActive(path, "/admin") ? {
                background: "var(--c-brand-bg)",
                color: "var(--c-brand)",
              } : { color: "var(--c-text-4)" }}
            >
              <Shield style={{ width: "18px", height: "18px" }} />
              <span className="mt-0.5 text-[10px]">Admin</span>
            </Link>
          )}

          <button
            onClick={signOut}
            title="Logout"
            className="mt-2 flex w-full flex-col items-center gap-1 rounded-xl p-2.5 text-[10px] transition-all"
            style={{ color: "var(--c-text-4)" }}
          >
            <LogOut style={{ width: "18px", height: "18px" }} />
            <span className="mt-0.5 text-[10px]">Logout</span>
          </button>
        </aside>

        {/* ── Main content ── */}
        <main className={`min-w-0 flex-1 ${isQbankSession ? "pb-0 md:pb-6" : "pb-20 md:pb-6"}`}>
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden ${isQbankSession ? "hidden" : ""}`}
        style={{ background: "var(--c-nav-bg)", borderColor: "var(--c-border)" }}
      >
        <div className="grid h-16 grid-cols-7">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition"
                style={{ color: active ? "var(--c-brand)" : "var(--c-text-4)" }}
              >
                <div
                  className="grid h-8 w-8 place-items-center rounded-full transition"
                  style={{ background: active ? "var(--c-brand-bg)" : "transparent" }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
