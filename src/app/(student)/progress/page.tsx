import { createClient, requireUser } from "@/lib/supabase/server";
import { BarChart2, Target, TrendingUp, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

type AttemptRow = {
  correct: boolean;
  created_at: string;
  questions?: {
    tags?: string[] | null;
    difficulty?: string | null;
  } | null;
};

export default async function ProgressPage() {
  const ctx = await requireUser();
  const s = await createClient();

  const { data } = await s
    .from("question_attempts")
    .select("correct,created_at,questions(tags,difficulty)")
    .eq("user_id", ctx!.user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const attempts = (data ?? []) as AttemptRow[];
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const incorrect = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  const byTag = new Map<string, { total: number; correct: number }>();
  const byDifficulty = new Map<string, { total: number; correct: number }>();

  for (const attempt of attempts) {
    for (const tag of attempt.questions?.tags ?? []) {
      const prev = byTag.get(tag) || { total: 0, correct: 0 };
      prev.total += 1;
      if (attempt.correct) prev.correct += 1;
      byTag.set(tag, prev);
    }

    const difficulty = attempt.questions?.difficulty || "unknown";
    const prevDiff = byDifficulty.get(difficulty) || { total: 0, correct: 0 };
    prevDiff.total += 1;
    if (attempt.correct) prevDiff.correct += 1;
    byDifficulty.set(difficulty, prevDiff);
  }

  const subjectRows = [...byTag.entries()]
    .map(([tag, value]) => ({
      tag,
      total: value.total,
      correct: value.correct,
      accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));

  const difficultyRows = [...byDifficulty.entries()]
    .map(([difficulty, value]) => ({
      difficulty,
      total: value.total,
      accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="page-shell pb-10">
      {/* Hero */}
      <section
        className="mt-4 overflow-hidden rounded-[30px] border p-6"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(124,58,237,0.10) 60%, rgba(37,99,235,0.08) 100%)",
          borderColor: "var(--c-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: "var(--c-brand)", background: "var(--c-brand-bg)", borderColor: "var(--c-brand-border)" }}
        >
          <BarChart2 className="h-3 w-3" />
          Analytics
        </div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>
          Performance Analytics
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7" style={{ color: "var(--c-text-3)" }}>
          Track your question performance, identify weaker subjects, and focus your next study session where it matters most.
        </p>
      </section>

      {/* Metric Cards */}
      <section className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          icon={<BookOpen className="h-5 w-5" />}
          label="Attempts"
          value={total}
          accentColor="#2563EB"
          bgGradient="linear-gradient(135deg, rgba(37,99,235,0.10), rgba(37,99,235,0.04))"
          borderColor="rgba(37,99,235,0.20)"
        />
        <Metric
          icon={<Target className="h-5 w-5" />}
          label="Correct"
          value={correct}
          accentColor="#10b981"
          bgGradient="linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"
          borderColor="rgba(16,185,129,0.24)"
        />
        <Metric
          icon={<TrendingUp className="h-5 w-5" />}
          label="Incorrect"
          value={incorrect}
          accentColor="#ef4444"
          bgGradient="linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.04))"
          borderColor="rgba(239,68,68,0.20)"
        />
        <Metric
          icon={<BarChart2 className="h-5 w-5" />}
          label="Accuracy"
          value={`${accuracy}%`}
          accentColor="#7c3aed"
          bgGradient="linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.04))"
          borderColor="rgba(124,58,237,0.24)"
        />
      </section>

      {/* Subject Breakdown */}
      <section
        className="mt-8 rounded-[28px] border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>Subject Breakdown</h2>
          <span
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ color: "var(--c-text-3)", borderColor: "var(--c-border)", background: "var(--c-elevated)" }}
          >
            {subjectRows.length} tracked subjects
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {subjectRows.length ? (
            subjectRows.map((row) => {
              const pct = row.accuracy;
              const barColor =
                pct >= 75
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : pct >= 50
                  ? "linear-gradient(90deg, #7c3aed, #6d28d9)"
                  : "linear-gradient(90deg, #f59e0b, #d97706)";
              return (
                <div
                  key={row.tag}
                  className="rounded-2xl border px-4 py-4 transition-all hover:shadow-md"
                  style={{
                    background: "var(--c-elevated)",
                    borderColor: "var(--c-border-subtle)",
                    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold" style={{ color: "var(--c-text-1)" }}>
                        {row.tag}
                      </div>
                      <div className="mt-0.5 text-sm" style={{ color: "var(--c-text-3)" }}>
                        {row.correct} / {row.total} correct
                      </div>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-sm font-bold"
                      style={{
                        color: pct >= 75 ? "#059669" : pct >= 50 ? "#7c3aed" : "#d97706",
                        background: pct >= 75 ? "rgba(16,185,129,0.10)" : pct >= 50 ? "rgba(124,58,237,0.10)" : "rgba(245,158,11,0.10)",
                      }}
                    >
                      {pct}%
                    </div>
                  </div>
                  <div
                    className="mt-3 h-2 rounded-full"
                    style={{ background: "var(--c-border)" }}
                  >
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="rounded-2xl border p-6 text-center text-sm"
              style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
            >
              No data yet. Attempt some questions to populate your analytics.
            </div>
          )}
        </div>
      </section>

      {/* Difficulty Breakdown */}
      <section
        className="mt-8 rounded-[28px] border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
      >
        <h2 className="text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>Difficulty Breakdown</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {difficultyRows.length ? (
            difficultyRows.map((row, i) => {
              const gradients = [
                "linear-gradient(90deg, #7c3aed, #10b981)",
                "linear-gradient(90deg, #2563eb, #7c3aed)",
                "linear-gradient(90deg, #10b981, #2563eb)",
                "linear-gradient(90deg, #f59e0b, #ef4444)",
              ];
              const barGradient = gradients[i % gradients.length];
              return (
                <div
                  key={row.difficulty}
                  className="rounded-2xl border p-4"
                  style={{ background: "var(--c-elevated)", borderColor: "var(--c-border-subtle)" }}
                >
                  <div
                    className="text-xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: "var(--c-text-3)" }}
                  >
                    {row.difficulty}
                  </div>
                  <div className="mt-2 text-3xl font-bold" style={{ color: "var(--c-text-1)" }}>
                    {row.total}
                  </div>
                  <div className="mt-0.5 text-sm" style={{ color: "var(--c-text-3)" }}>
                    questions attempted
                  </div>
                  <div
                    className="mt-4 h-2 rounded-full"
                    style={{ background: "var(--c-border)" }}
                  >
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${row.accuracy}%`, background: barGradient }}
                    />
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: "var(--c-text-2)" }}>
                    Accuracy: {row.accuracy}%
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="rounded-2xl border p-6 text-center text-sm sm:col-span-2"
              style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}
            >
              Difficulty analytics will appear after you complete more question sessions.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accentColor,
  bgGradient,
  borderColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accentColor: string;
  bgGradient: string;
  borderColor: string;
}) {
  return (
    <div
      className="rounded-[24px] border p-5"
      style={{ background: bgGradient, borderColor, boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.55)", color: accentColor, backdropFilter: "blur(4px)" }}
      >
        {icon}
      </div>
      <div className="mt-4 text-sm font-medium" style={{ color: "var(--c-text-3)" }}>
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold" style={{ color: accentColor }}>
        {value}
      </div>
    </div>
  );
}
