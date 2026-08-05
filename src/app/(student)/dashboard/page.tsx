import Link from "next/link";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Layers,
  PlaySquare,
  Sparkles,
  BarChart2,
  ChevronRight,
  Target,
} from "lucide-react";

export const dynamic = "force-dynamic";

type AttemptRow = {
  correct: boolean;
  questions?: { tags?: string[] | null } | null;
};

export default async function DashboardPage() {
  const ctx = await requireUser();
  const s = await createClient();

  const [
    { count: qCount },
    { count: flashCount },
    { count: noteCount },
    { count: documentCount },
    { count: videoCount },
    { data: attempts },
  ] = await Promise.all([
    s.from("questions").select("*", { count: "exact", head: true }),
    s.from("flashcards").select("*", { count: "exact", head: true }),
    s.from("notes").select("*", { count: "exact", head: true }).eq("user_id", ctx!.user.id),
    s.from("lessons").select("*", { count: "exact", head: true }).eq("visible", true).in("kind", ["pdf", "html", "html-file", "html-inline", "notes", "qbank"]),
    s.from("lessons").select("*", { count: "exact", head: true }).eq("visible", true).contains("meta", { type: "video" }),
    s
      .from("question_attempts")
      .select("correct,questions(tags)")
      .eq("user_id", ctx!.user.id)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const firstName = (ctx?.profile?.full_name || ctx?.profile?.email || "Doctor").split(" ")[0];
  const attemptRows = (attempts ?? []) as AttemptRow[];
  const totalAttempts = attemptRows.length;
  const correct = attemptRows.filter((item) => item.correct).length;
  const accuracy = totalAttempts ? Math.round((correct / totalAttempts) * 100) : 0;

  const byTag = new Map<string, { total: number; correct: number }>();
  for (const row of attemptRows) {
    for (const tag of row.questions?.tags ?? []) {
      const prev = byTag.get(tag) || { total: 0, correct: 0 };
      prev.total += 1;
      if (row.correct) prev.correct += 1;
      byTag.set(tag, prev);
    }
  }

  const weakest = [...byTag.entries()]
    .map(([tag, value]) => ({
      tag,
      accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
      total: value.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, 5);

  const recommendation = weakest[0]?.tag || "Question Bank";
  const completionFiles = (noteCount ?? 0) + (flashCount ?? 0);

  return (
    <div className="page-shell">
      {/* Hero */}
      <section
        className="mt-4 rounded-3xl border p-6 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(5,150,105,0.07) 100%)",
          borderColor: "var(--c-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--c-blue)", background: "var(--c-blue-bg)", borderColor: "var(--c-blue-border)" }}
        >
          Student Dashboard
        </div>
        <h1
          className="mt-4 text-3xl font-bold tracking-tight"
          style={{ color: "var(--c-text-1)" }}
        >
          Welcome back, <span style={{ color: "var(--c-brand)" }}>{firstName}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
          Pick up where you left off, review your performance, and jump back into your study materials.
        </p>
      </section>

      {/* Metrics */}
      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={<Target className="h-5 w-5" />}
          label="Completion"
          value={`${completionFiles}`}
          subValue={`/${Math.max((documentCount ?? 0) + (videoCount ?? 0), 1)} files`}
          accentColor="var(--c-blue)"
        />
        <MetricCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Average Score"
          value={totalAttempts ? `${accuracy}%` : "N/A"}
          subValue={totalAttempts ? `${correct}/${totalAttempts} correct` : "No attempts yet"}
          accentColor="#a855f7"
        />
        <MetricCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Overall Progress"
          value={`${accuracy}%`}
          subValue="Live performance tracking"
          accentColor="var(--c-brand)"
          progress={accuracy}
        />
      </section>

      {/* Quick Start */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "var(--c-text-1)" }}>Quick Start</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <QuickCard href="/qbank" icon={<BookOpen className="h-6 w-6" />} badge="Adaptive" title="Practice Questions" desc="Adaptive quiz session" accentColor="var(--c-blue)" />
          <QuickCard href="/self-assessment" icon={<ClipboardCheck className="h-6 w-6" />} badge="NBME" title="Self Assessment" desc="CMS, NBME & blocks" accentColor="#a855f7" />
          <QuickCard href="/videos" icon={<PlaySquare className="h-6 w-6" />} title="Watch Videos" desc="Curated lectures" accentColor="var(--c-brand)" />
          <QuickCard href="/flashcards" icon={<Layers className="h-6 w-6" />} badge="SRS" title="Flashcards" desc="Spaced repetition" accentColor="#f59e0b" />
        </div>
      </section>

      {/* Performance by Subject */}
      <section
        className="mt-8 rounded-3xl border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>Performance by Subject</h2>
          <Link href="/progress" className="text-sm font-medium" style={{ color: "var(--c-brand)" }}>
            View Full Analytics
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {(weakest.length ? weakest : [
            { tag: "Cardiology", accuracy: 0, total: 0 },
            { tag: "Respiratory", accuracy: 0, total: 0 },
            { tag: "Neurology", accuracy: 0, total: 0 },
            { tag: "Gastroenterology", accuracy: 0, total: 0 },
            { tag: "Pharmacology", accuracy: 0, total: 0 },
          ]).map((row) => (
            <div key={row.tag} className="grid grid-cols-[1fr_90px_48px] items-center gap-4">
              <div className="truncate text-sm" style={{ color: "var(--c-text-2)" }}>{row.tag}</div>
              <div className="h-2 rounded-full" style={{ background: "var(--c-elevated)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${row.accuracy}%`,
                    background: "linear-gradient(90deg, var(--c-blue), var(--c-brand))",
                  }}
                />
              </div>
              <div className="text-right text-sm" style={{ color: "var(--c-text-3)" }}>{row.accuracy}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Goals */}
      <section
        className="mt-6 rounded-3xl border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>Daily Goals</h2>
        <div className="mt-5 space-y-3">
          <GoalRow label="30 questions" done={totalAttempts >= 30} />
          <GoalRow label="1 video lesson" done={(videoCount ?? 0) > 0} />
          <GoalRow label="20 flashcards" done={(flashCount ?? 0) >= 20} />
        </div>
      </section>

      {/* Smart Recommendation */}
      <section
        className="mt-6 rounded-3xl border p-5"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.10), rgba(37,99,235,0.07))",
          borderColor: "var(--c-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2 className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>Smart Study Recommendation</h2>
        <p className="mt-3 text-sm leading-7" style={{ color: "var(--c-text-2)" }}>
          {totalAttempts === 0
            ? "Start with the Question Bank to establish your baseline performance, then let the platform personalize your study path."
            : `Your current weakest tracked area is ${recommendation}. Start there to improve your score faster.`}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/qbank"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition"
            style={{ background: "linear-gradient(90deg, #7c3aed, #2563eb)" }}
          >
            Start Session <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/self-assessment" className="btn-ghost text-sm">
            Open Self Assessment
          </Link>
        </div>
      </section>

      {/* Mini Stats */}
      <section className="mt-6 grid grid-cols-2 gap-4">
        <MiniStat label="Q-Banks" value={qCount ?? 0} icon={<BookOpen className="h-4 w-4" />} />
        <MiniStat label="Study Files" value={documentCount ?? 0} icon={<FileText className="h-4 w-4" />} />
        <MiniStat label="Videos" value={videoCount ?? 0} icon={<PlaySquare className="h-4 w-4" />} />
        <MiniStat label="Flashcards" value={flashCount ?? 0} icon={<Layers className="h-4 w-4" />} />
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subValue,
  accentColor,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue: string;
  accentColor: string;
  progress?: number;
}) {
  return (
    <div
      className="rounded-3xl border p-5"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ background: "var(--c-elevated)", color: accentColor }}
      >
        {icon}
      </div>
      <div className="mt-4 text-sm" style={{ color: "var(--c-text-3)" }}>{label}</div>
      <div className="mt-1 text-3xl font-bold" style={{ color: accentColor }}>{value}</div>
      <div className="mt-1 text-xs" style={{ color: "var(--c-text-4)" }}>{subValue}</div>
      {typeof progress === "number" ? (
        <div
          className="mt-4 h-1.5 rounded-full"
          style={{ background: "var(--c-elevated)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--c-blue), var(--c-brand))",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function QuickCard({
  href,
  icon,
  badge,
  title,
  desc,
  accentColor,
}: {
  href: string;
  icon: React.ReactNode;
  badge?: string;
  title: string;
  desc: string;
  accentColor: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border p-5 block transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{ background: "var(--c-elevated)", color: accentColor }}
        >
          {icon}
        </div>
        {badge ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: "var(--c-elevated)", color: "var(--c-text-3)" }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 text-base font-bold leading-tight" style={{ color: "var(--c-text-1)" }}>{title}</div>
      <div className="mt-1 text-xs" style={{ color: "var(--c-text-3)" }}>{desc}</div>
    </Link>
  );
}

function GoalRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-5 w-5 rounded-full border-2 flex items-center justify-center transition"
        style={{
          borderColor: done ? "var(--c-brand)" : "var(--c-border)",
          background: done ? "var(--c-brand-bg)" : "transparent",
        }}
      >
        {done && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-brand)" }} />
          </svg>
        )}
      </div>
      <div className="text-sm" style={{ color: done ? "var(--c-text-2)" : "var(--c-text-3)" }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2" style={{ color: "var(--c-text-3)" }}>
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>{value}</div>
    </div>
  );
}
