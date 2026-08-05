import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExternalLink, PlaySquare, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const TELEGRAM_GROUPS = [
  {
    title: "Tricky & High-Yield Repeated Questions",
    description: "Repeated questions, tricky patterns, and fast high-yield revision.",
    href: "https://t.me/+bUbYEhV5-j00MWJk",
  },
  {
    title: "Discussion Group",
    description: "Open discussion space for questions, clarifications, and peer help.",
    href: "https://t.me/+-ClnfFToezozMTJk",
  },
  {
    title: "IFOM CSE Concepts in Two Weeks",
    description: "Focused concept review track to cover IFOM CSE essentials quickly.",
    href: "https://t.me/+xwL_dkPKKINiMGRk",
  },
] as const;

export default async function VideosPage() {
  const s = await createClient();
  const { data: videos } = await s
    .from("lessons")
    .select("id, title, meta")
    .eq("kind", "html")
    .contains("meta", { type: "video" })
    .eq("visible", true)
    .order("created_at", { ascending: false });

  return (
    <div className="page-shell">
      <h1 className="section-title text-3xl">Videos</h1>
      <p className="mt-2 text-lg text-slate-400">Learn with medical education videos</p>

      <section className="mt-6 overflow-hidden rounded-[28px] border border-ink-800 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.10),rgba(8,15,30,0.98)_60%)] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Telegram communities</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Study groups & fast discussion access</h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">Curated Telegram links for repeated questions, discussion, and intensive IFOM CSE review.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {TELEGRAM_GROUPS.map((group) => (
            <a
              key={group.href}
              href={group.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-[24px] border border-ink-700 bg-[#0b1322] p-5 transition hover:border-emerald-400/40 hover:bg-[#0d1728]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  <PlaySquare className="h-5 w-5" />
                </div>
                <ExternalLink className="h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
              </div>
              <div className="mt-4 text-lg font-semibold text-white">{group.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{group.description}</div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Open on Telegram</div>
            </a>
          ))}
        </div>
      </section>

      <Link href="/courses" className="btn-primary mt-6 inline-flex text-lg"><Plus className="h-5 w-5" /> Add Video</Link>

      {!videos?.length ? (
        <div className="card mt-6 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.03] text-slate-400"><PlaySquare className="h-8 w-8" /></div>
          <h2 className="mt-5 text-3xl font-semibold">No Videos Yet</h2>
          <p className="mt-3 text-lg leading-8 text-slate-400">Videos will appear here once they are added to the platform.</p>
          <div className="btn-primary mt-5 opacity-80">Videos Coming Soon</div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {videos.map((video: any) => (
            <Link key={video.id} href={`/lesson/${video.id}`} className="card block p-5 transition hover:border-brand/40">
              <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Video session</div>
              <div className="mt-2 text-xl font-semibold text-slate-100">{video.title}</div>
              <div className="mt-2 text-sm text-slate-400">Open the embedded session and its attached study document inside the platform.</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
