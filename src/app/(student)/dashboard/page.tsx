import Link from "next/link";
import TrialActivationCards from "@/components/TrialActivationCards";
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
  Zap,
  Trophy,
  Clock,
  Flame,
  TrendingUp,
  Brain,
  Star,
  ArrowRight,
} from "lucide-react";
import { ContinueStudyingCarousel } from "./ContinueStudyingCarousel";

export const dynamic = "force-dynamic";

type AttemptRow = {
  correct: boolean;
  created_at: string;
  questions?: { tags?: string[] | null; subject?: string | null } | null;
};

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  course_id?: string | null;
};

type QuestionLessonRow = {
  id: string;
  lesson_id: string | null;
};

type ActivityRow = {
  lesson_id: string | null;
  activity_type: string;
  created_at: string;
};

type FlashSessionRow = {
  total: number | null;
  started_at: string | null;
};

type ContinueLessonRow = LessonRow & {
  progressPercent: number | null;
  stateLabel: string | null;
};

export default async function DashboardPage() {
  const ctx = await requireUser();
  const s = await createClient();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const [
    { count: qCount },
    { count: flashCount },
    { count: noteCount },
    { count: documentCount },
    { count: videoCount },
    { data: attempts },
    { data: recentLessons },
    { data: flashSessions },
    { data: activityRows },
  ] = await Promise.all([
    s.from("questions").select("*", { count: "exact", head: true }),
    s.from("flashcards").select("*", { count: "exact", head: true }),
    s.from("notes").select("*", { count: "exact", head: true }).eq("user_id", ctx!.user.id),
    s.from("lessons").select("*", { count: "exact", head: true }).eq("visible", true).in("kind", ["pdf", "html", "html-file", "html-inline", "notes", "qbank"]),
    s.from("lessons").select("*", { count: "exact", head: true }).eq("visible", true).contains("meta", { type: "video" }),
    s
      .from("question_attempts")
      .select("correct,created_at,questions(tags)")
      .eq("user_id", ctx!.user.id)
      .order("created_at", { ascending: false })
      .limit(400),
    s.from("lessons").select("id,title,kind,course_id").eq("visible", true).limit(12),
    s.from("flashcard_sessions").select("total,started_at").eq("user_id", ctx!.user.id).order("started_at", { ascending: false }).limit(200),
    s.from("student_activity_logs").select("lesson_id,activity_type,created_at").eq("user_id", ctx!.user.id).order("created_at", { ascending: false }).limit(400),
  ]);

  const firstName = (ctx?.profile?.full_name || ctx?.profile?.email || "Doctor").split(" ")[0];
  const attemptRows = (attempts ?? []) as AttemptRow[];
  const totalAttempts = attemptRows.length;
  const correct = attemptRows.filter((item) => item.correct).length;
  const accuracy = totalAttempts ? Math.round((correct / totalAttempts) * 100) : 0;

  // Daily streak
  const uniqueDays = new Set(attemptRows.map((a) => a.created_at?.split("T")[0]).filter(Boolean));
  let streak = 0;
  const checkDate = new Date();
  while (uniqueDays.has(checkDate.toISOString().split("T")[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Today's attempts
  const todayAttempts = attemptRows.filter((a) => a.created_at?.startsWith(todayStr));
  const todayCorrect = todayAttempts.filter((a) => a.correct).length;
  const todayTotal = todayAttempts.length;
  const todayGoalQ = 30;
  const todayGoalFlash = 20;
  const flashSessionRows = (flashSessions ?? []) as FlashSessionRow[];
  const activity = (activityRows ?? []) as ActivityRow[];
  const todayFlashDone = flashSessionRows
    .filter((row) => row.started_at?.startsWith(todayStr))
    .reduce((sum, row) => sum + Math.max(0, row.total ?? 0), 0);
  const todayVideoDone = 0;

  // Subject performance
  const byTag = new Map<string, { total: number; correct: number }>();
  for (const row of attemptRows) {
    for (const tag of row.questions?.tags ?? []) {
      const prev = byTag.get(tag) || { total: 0, correct: 0 };
      prev.total += 1;
      if (row.correct) prev.correct += 1;
      byTag.set(tag, prev);
    }
  }

  const subjectPerf = [...byTag.entries()]
    .map(([tag, value]) => ({
      tag,
      accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
      total: value.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const weakest = [...subjectPerf].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
  const recommended = weakest[0]?.tag || "Question Bank";

  const lessonsData = (recentLessons ?? []) as LessonRow[];
  const lessonIds = lessonsData.map((lesson) => lesson.id).filter(Boolean);

  const [{ data: lessonQuestionRows }, { data: attemptLessonRows }] = lessonIds.length
    ? await Promise.all([
        s.from("questions").select("id,lesson_id").in("lesson_id", lessonIds),
        s
          .from("question_attempts")
          .select("question_id,questions(lesson_id)")
          .eq("user_id", ctx!.user.id)
          .order("created_at", { ascending: false })
          .limit(2000),
      ])
    : [{ data: [] as QuestionLessonRow[] }, { data: [] as Array<{ question_id?: string | null; questions?: { lesson_id?: string | null } | null }> }];

  const questionsByLesson = new Map<string, Set<string>>();
  for (const row of (lessonQuestionRows ?? []) as QuestionLessonRow[]) {
    if (!row.lesson_id || !row.id) continue;
    const set = questionsByLesson.get(row.lesson_id) ?? new Set<string>();
    set.add(row.id);
    questionsByLesson.set(row.lesson_id, set);
  }

  const attemptedByLesson = new Map<string, Set<string>>();
  for (const row of (attemptLessonRows ?? []) as Array<{ question_id?: string | null; questions?: { lesson_id?: string | null } | null }>) {
    const lessonId = row.questions?.lesson_id ?? null;
    const questionId = row.question_id ?? null;
    if (!lessonId || !questionId || !lessonIds.includes(lessonId)) continue;
    const set = attemptedByLesson.get(lessonId) ?? new Set<string>();
    set.add(questionId);
    attemptedByLesson.set(lessonId, set);
  }

  const touchedLessonIds = new Set(activity.map((row) => row.lesson_id).filter((value): value is string => Boolean(value)));
  const activityOrder = new Map<string, number>();
  activity.forEach((row, index) => {
    if (row.lesson_id && !activityOrder.has(row.lesson_id)) activityOrder.set(row.lesson_id, index);
  });

  const continueLessons: ContinueLessonRow[] = lessonsData.map((lesson) => {
    const totalQuestions = questionsByLesson.get(lesson.id)?.size ?? 0;
    const attemptedQuestions = attemptedByLesson.get(lesson.id)?.size ?? 0;
    if (totalQuestions > 0 && attemptedQuestions > 0) {
      return {
        ...lesson,
        progressPercent: Math.min(100, Math.round((attemptedQuestions / totalQuestions) * 100)),
        stateLabel: null,
      };
    }
    if (touchedLessonIds.has(lesson.id)) {
      return { ...lesson, progressPercent: null, stateLabel: "In progress" };
    }
    return { ...lesson, progressPercent: null, stateLabel: "New" };
  }).sort((a, b) => {
    const aTouched = touchedLessonIds.has(a.id);
    const bTouched = touchedLessonIds.has(b.id);
    if (aTouched !== bTouched) return aTouched ? -1 : 1;
    const aOrder = activityOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = activityOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

  const activatedAt = typeof ctx?.profile?.activated_at === "string" ? ctx.profile.activated_at : null;
  const activationTime = activatedAt ? new Date(activatedAt).getTime() : Number.NaN;
  const showTrialActivationCards = Number.isFinite(activationTime) && Date.now() - activationTime < 2 * 24 * 60 * 60 * 1000;

  const greetingHour = today.getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="page-shell space-y-5">
      {showTrialActivationCards && activatedAt ? <TrialActivationCards activatedAt={activatedAt} /> : null}

      {/* ── WELCOME BACK ── */}
      <section
        className="rounded-3xl border p-6 overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(96,165,250,0.06) 50%, rgba(167,139,250,0.04) 100%)",
          borderColor: "rgba(52,211,153,0.20)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ background: "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(52,211,153,0.06) 0%, transparent 70%)" }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-sm mb-1" style={{ color: "var(--c-text-4)" }}>{greeting} 👋</div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>
              Welcome back, <span style={{ color: "var(--c-brand)" }}>{firstName}</span>
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--c-text-3)" }}>
              {totalAttempts > 0
                ? `You've answered ${totalAttempts} questions with ${accuracy}% accuracy. Keep going!`
                : "Start your first practice session to track your progress."}
            </p>
          </div>

          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border px-5 py-3 shrink-0"
              style={{ borderColor: "rgba(251,146,60,0.30)", background: "rgba(251,146,60,0.08)" }}>
              <Flame className="h-5 w-5 text-orange-400" />
              <div>
                <div className="text-xl font-bold text-orange-400">{streak}</div>
                <div className="text-xs text-orange-300/70">Day streak</div>
              </div>
            </div>
          )}
        </div>

        {/* Quick stats row */}
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Questions", value: totalAttempts, icon: <BookOpen className="h-4 w-4" />, color: "#60a5fa" },
            { label: "Accuracy", value: `${accuracy}%`, icon: <Target className="h-4 w-4" />, color: "#34d399" },
            { label: "Correct", value: correct, icon: <Sparkles className="h-4 w-4" />, color: "#a78bfa" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--c-text-4)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TODAY'S GOAL ── */}
      <section className="rounded-3xl border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
            <Target className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Today's Goal</h2>
          <span className="ml-auto text-xs" style={{ color: "var(--c-text-4)" }}>{today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
        </div>

        <div className="space-y-3">
          {[
            { label: "Practice Questions", done: todayTotal, goal: todayGoalQ, unit: "questions", icon: <BookOpen className="h-3.5 w-3.5" />, color: "#60a5fa" },
            { label: "Flashcard Review", done: Math.min(todayFlashDone, todayGoalFlash), goal: todayGoalFlash, unit: "cards", icon: <Layers className="h-3.5 w-3.5" />, color: "#f59e0b" },
            { label: "Watch a Video Lesson", done: todayVideoDone, goal: 1, unit: "video", icon: <PlaySquare className="h-3.5 w-3.5" />, color: "#34d399" },
          ].map((g) => {
            const pct = g.goal > 0 ? Math.min(100, Math.round((g.done / g.goal) * 100)) : 0;
            return (
              <div key={g.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--c-text-2)" }}>
                    <span style={{ color: g.color }}>{g.icon}</span>
                    {g.label}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: pct >= 100 ? "#34d399" : "var(--c-text-4)" }}>
                    {g.done}/{g.goal} {g.unit}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--c-elevated)" }}>
                  <div className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: pct >= 100 ? "#34d399" : g.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CONTINUE STUDYING — Horizontal Carousel ── */}
      {lessonsData.length > 0 && (
        <section className="rounded-3xl border p-5"
          style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                <PlaySquare className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Continue Studying</h2>
            </div>
            <Link href="/courses" className="text-xs font-medium" style={{ color: "var(--c-brand)" }}>View all →</Link>
          </div>

          {/* Horizontal scrollable carousel */}
          <ContinueStudyingCarousel lessons={continueLessons} />
        </section>
      )}

      {/* ── QUICK ACCESS ── */}
      <section>
        <h2 className="text-base font-bold mb-3" style={{ color: "var(--c-text-1)" }}>Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/qbank", icon: <BookOpen className="h-6 w-6" />, badge: "Adaptive", title: "Practice Questions", desc: "Start a quiz session", color: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
            { href: "/self-assessment", icon: <ClipboardCheck className="h-6 w-6" />, badge: "NBME", title: "Self Assessment", desc: "CMS & NBME blocks", color: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
            { href: "/flashcards", icon: <Layers className="h-6 w-6" />, badge: "SRS", title: "Flashcards", desc: "Spaced repetition", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
            { href: "/courses", icon: <PlaySquare className="h-6 w-6" />, title: "Video Courses", desc: "Curated lectures", color: "#34d399", bg: "rgba(52,211,153,0.10)" },
          ].map((c) => (
            <Link key={c.href} href={c.href}
              className="card rounded-3xl p-5 block hover:-translate-y-0.5 transition-all"
              style={{ background: "var(--c-card)" }}>
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: c.bg, color: c.color }}>
                  {c.icon}
                </div>
                {c.badge && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: c.bg, color: c.color }}>
                    {c.badge}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold leading-tight mb-1" style={{ color: "var(--c-text-1)" }}>{c.title}</div>
              <div className="text-xs" style={{ color: "var(--c-text-3)" }}>{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── RECENT ACTIVITY + PERFORMANCE SUMMARY (side by side on large screens) ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Recent Activity */}
        <section className="rounded-3xl border p-5"
          style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
              <Zap className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Recent Activity</h2>
          </div>

          {todayTotal > 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl p-4 border"
                style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
                <div className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: "var(--c-text-4)" }}>Today</div>
                <div className="flex items-center justify-between">
                  <div className="text-sm" style={{ color: "var(--c-text-2)" }}>{todayTotal} questions attempted</div>
                  <div className="text-sm font-bold" style={{ color: todayCorrect / todayTotal > 0.7 ? "#34d399" : "#f59e0b" }}>
                    {todayTotal ? Math.round((todayCorrect / todayTotal) * 100) : 0}%
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: "var(--c-border)" }}>
                  <div className="h-1.5 rounded-full"
                    style={{ width: `${todayTotal ? Math.round((todayCorrect / todayTotal) * 100) : 0}%`, background: "#34d399" }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}>
                  <div className="text-xl font-bold" style={{ color: "#34d399" }}>{todayCorrect}</div>
                  <div className="text-xs" style={{ color: "var(--c-text-4)" }}>Correct</div>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                  <div className="text-xl font-bold text-red-400">{todayTotal - todayCorrect}</div>
                  <div className="text-xs" style={{ color: "var(--c-text-4)" }}>Incorrect</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-center" style={{ background: "var(--c-elevated)" }}>
              <BookOpen className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--c-text-4)" }} />
              <div className="text-sm font-medium mb-1" style={{ color: "var(--c-text-2)" }}>No activity today</div>
              <div className="text-xs mb-4" style={{ color: "var(--c-text-4)" }}>Start a session to track your progress</div>
              <Link href="/qbank" className="btn-primary text-sm px-4 py-2">Start Session</Link>
            </div>
          )}
        </section>

        {/* Performance Summary */}
        <section className="rounded-3xl border p-5"
          style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                <BarChart2 className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Performance Summary</h2>
            </div>
            <Link href="/progress" className="text-xs font-medium" style={{ color: "var(--c-brand)" }}>Full report</Link>
          </div>

          <div className="space-y-3">
            {(subjectPerf.length ? subjectPerf : [
              { tag: "Cardiology", accuracy: 0, total: 0 },
              { tag: "Pharmacology", accuracy: 0, total: 0 },
              { tag: "Neurology", accuracy: 0, total: 0 },
              { tag: "Respiratory", accuracy: 0, total: 0 },
              { tag: "Gastroenterology", accuracy: 0, total: 0 },
            ]).map((row) => {
              const barColor = row.accuracy >= 80 ? "#34d399" : row.accuracy >= 60 ? "#f59e0b" : "#f87171";
              return (
                <div key={row.tag} className="grid grid-cols-[1fr_80px_44px] items-center gap-3">
                  <div className="truncate text-sm" style={{ color: "var(--c-text-2)" }}>{row.tag}</div>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--c-elevated)" }}>
                    <div className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${row.accuracy}%`, background: barColor }} />
                  </div>
                  <div className="text-right text-xs font-semibold" style={{ color: barColor }}>
                    {row.accuracy}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall score */}
          <div className="mt-4 rounded-2xl p-3 flex items-center justify-between"
            style={{ background: "var(--c-elevated)" }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--c-text-3)" }}>
              <TrendingUp className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
              Overall Accuracy
            </div>
            <div className="text-base font-bold" style={{ color: "var(--c-brand)" }}>{accuracy}%</div>
          </div>
        </section>
      </div>

      {/* ── DAILY STREAK ── */}
      <section className="rounded-3xl border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c" }}>
            <Flame className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Daily Streak</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="text-center sm:text-left">
            <div className="text-5xl font-bold text-orange-400">{streak}</div>
            <div className="text-sm mt-1" style={{ color: "var(--c-text-3)" }}>
              {streak === 0 ? "Start your streak today!" : streak === 1 ? "1 day — great start!" : `${streak} days in a row`}
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const dayStr = d.toISOString().split("T")[0];
              const active = uniqueDays.has(dayStr);
              const isToday = dayStr === todayStr;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="text-[10px]" style={{ color: "var(--c-text-4)" }}>
                    {d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}
                  </div>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center border transition"
                    style={{
                      background: active ? "rgba(251,146,60,0.20)" : "var(--c-elevated)",
                      borderColor: isToday ? "#fb923c" : active ? "rgba(251,146,60,0.30)" : "var(--c-border)",
                    }}>
                    {active ? <Flame className="h-3.5 w-3.5 text-orange-400" /> : <div className="h-2 w-2 rounded-full" style={{ background: "var(--c-border)" }} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sm:ml-auto">
            <Link href="/qbank" className="btn-primary text-sm px-5 py-2.5 rounded-2xl">
              {streak === 0 ? "Start Today" : "Keep Going"} <Flame className="h-3.5 w-3.5 inline ml-1 text-orange-300" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── UPCOMING EXAMS ── */}
      <section className="rounded-3xl border p-5"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
            <Clock className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Upcoming Exams</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: "USMLE Step 1", date: "Scheduled by you", icon: <Star className="h-4 w-4" />, color: "#60a5fa", bg: "rgba(96,165,250,0.10)", href: "/self-assessment" },
            { title: "IFOM CSE Simulator", date: "Full-length mock exam", icon: <Trophy className="h-4 w-4" />, color: "#a78bfa", bg: "rgba(167,139,250,0.10)", href: "/self-assessment" },
            { title: "Subject Assessment", date: "Track your readiness", icon: <Brain className="h-4 w-4" />, color: "#34d399", bg: "rgba(52,211,153,0.10)", href: "/qbank" },
          ].map((exam) => (
            <Link key={exam.title} href={exam.href}
              className="rounded-2xl p-4 flex items-center gap-3 border transition hover:-translate-y-0.5"
              style={{ background: exam.bg, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="grid h-9 w-9 place-items-center rounded-xl shrink-0"
                style={{ background: "rgba(255,255,255,0.08)", color: exam.color }}>
                {exam.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--c-text-1)" }}>{exam.title}</div>
                <div className="text-xs" style={{ color: "var(--c-text-4)" }}>{exam.date}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── RECOMMENDED SUBJECTS ── */}
      <section className="rounded-3xl border p-5"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(37,99,235,0.06))",
          borderColor: "rgba(167,139,250,0.25)",
          boxShadow: "var(--shadow-card)",
        }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
            <Brain className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>Recommended Subjects</h2>
        </div>

        <p className="text-sm mb-5" style={{ color: "var(--c-text-3)" }}>
          {totalAttempts === 0
            ? "Start with the Q-Bank to build your baseline. We'll recommend study areas based on your performance."
            : `Focus on ${recommended} to boost your overall score. Here are your priority areas:`}
        </p>

        {weakest.length > 0 ? (
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            {weakest.map((w, i) => (
              <Link key={w.tag} href={`/qbank?subject=${encodeURIComponent(w.tag)}`}
                className="rounded-2xl p-4 border transition hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold"
                    style={{ background: "rgba(167,139,250,0.20)", color: "#a78bfa" }}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#f87171" }}>Focus area</span>
                </div>
                <div className="text-sm font-semibold truncate mb-1" style={{ color: "var(--c-text-1)" }}>{w.tag}</div>
                <div className="text-xs" style={{ color: "#f87171" }}>{w.accuracy}% accuracy · {w.total} questions</div>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/qbank"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            style={{ background: "linear-gradient(90deg, #7c3aed, #2563eb)" }}>
            Start Recommended Session <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/progress" className="btn-ghost text-sm rounded-2xl">
            View Full Analytics <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── RESOURCES MINI STATS ── */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--c-text-3)" }}>Platform Resources</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Q-Bank Questions", value: qCount ?? 0, icon: <BookOpen className="h-4 w-4" /> },
            { label: "Study Files", value: documentCount ?? 0, icon: <FileText className="h-4 w-4" /> },
            { label: "Video Lessons", value: videoCount ?? 0, icon: <PlaySquare className="h-4 w-4" /> },
            { label: "Flashcards", value: flashCount ?? 0, icon: <Layers className="h-4 w-4" /> },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border p-4"
              style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: "var(--c-text-4)" }}>
                {s.icon}
                <span className="text-xs">{s.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
