import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  FileText,
  HelpCircle,
  PlaySquare,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  BarChart2,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
  BookOpen,
  Target,
  Zap,
  RotateCcw,
  Bookmark,
  TrendingUp,
  Calendar,
  Brain,
  Flame,
  Layers,
} from "lucide-react";
import { requireActive, createAdminClient } from "@/lib/supabase/server";
import { getSubjectDetail } from "@/lib/subject-data";
import { getSubjectIconName } from "@/lib/subjects";
import ExpandableSection from "./ExpandableSection";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ exam?: string }>;
type Params = Promise<{ slug: string }>;

type SubjectLesson = {
  id: string;
  title: string;
  kind: string;
  meta?: Record<string, unknown> | null;
};

type QuizSession = {
  id: string;
  mode: string;
  subject_title: string | null;
  question_count: number;
  current_index: number;
  status: "active" | "suspended" | "complete";
  score_pct: number | null;
  seconds_elapsed: number | null;
  created_at: string;
  completed_at: string | null;
};

type AttemptRow = {
  correct: boolean;
  created_at: string;
};

type BlockAttemptRow = {
  question_id: string | null;
  correct: boolean;
  questions?: { lesson_id?: string | null } | null;
};

type FlashcardReviewRow = {
  flashcard_id: string;
  due_at: string;
  repetitions: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function classifyDocumentSection(doc: SubjectLesson): "notes" | "qbank" | "active-qbank" {
  const section = typeof doc.meta?.section === "string" ? doc.meta.section.toLowerCase().trim() : "";
  const category = typeof doc.meta?.category === "string" ? doc.meta.category.toLowerCase().trim() : "";
  const blockKind = typeof doc.meta?.block_kind === "string" ? doc.meta.block_kind.toLowerCase().trim() : "";
  const isActive = Boolean(doc.meta?.is_active_qbank) || blockKind === "active" || section === "qbank-active" || category === "qbank-active";
  if (isActive) return "active-qbank";

  const isQbank = doc.kind === "qbank" || section === "qbank" || category === "qbank" || blockKind === "official" || blockKind === "practice";
  if (isQbank) return "qbank";

  return "notes";
}

function externalLabel(provider?: string | null) {
  if (provider === "telegram") return "Telegram";
  if (provider === "youtube") return "YouTube";
  if (provider === "zoom") return "Zoom";
  return "External";
}

function conciseTitle(kind: "video" | "notes" | "qbank", index: number, originalTitle: string) {
  const n = originalTitle.toLowerCase();
  if (kind === "video") {
    if (/intro|orientation/.test(n)) return `Orientation Session ${index}`;
    if (/case/.test(n)) return `Clinical Case ${index}`;
    if (/review/.test(n)) return `High-Yield Review ${index}`;
    return `Video Session ${index}`;
  }
  if (kind === "notes") {
    if (/summary|concise/.test(n)) return `Concise Review Notes ${index}`;
    if (/high-yield/.test(n)) return `High-Yield Notes ${index}`;
    return `Notes Document ${index}`;
  }
  if (/repeated/.test(n)) return `Repeated Questions ${index}`;
  if (/high-yield/.test(n)) return `High-Yield Block ${index}`;
  return `Q-Bank Block ${index}`;
}

function friendlyDocTitle(rawTitle: string, index: number): string {
  const n = rawTitle.toLowerCase();
  // Strip file extensions and technical prefixes
  const cleaned = rawTitle
    .replace(/\.(html|pdf|docx?|pptx?)$/i, "")
    .replace(/^ch\d+_?/i, "")
    .replace(/_/g, " ")
    .replace(/\b(\w)/g, (c) => c.toUpperCase())
    .trim();
  if (cleaned.length > 4) return cleaned;
  // Fallback to kind-based name
  if (/video/i.test(n)) return `Video Session ${index}`;
  if (/note|doc|file/i.test(n)) return `Study Document ${index}`;
  return `Resource ${index}`;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function secondsToTime(secs: number | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-2 w-full rounded-full bg-ink-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-ink-700 bg-ink-950/70 px-4 py-3 text-center">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}

// ─── Mini Today Card ──────────────────────────────────────────────────────────
function TodayCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink-700 bg-ink-950/60 p-3">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default async function SubjectDashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const ctx = await requireActive();
  if (!ctx) notFound();

  const { slug } = await params;
  const { exam = "IFOM_CSE" } = await searchParams;
  const detail = await getSubjectDetail(slug, exam);
  if (!detail) notFound();

  const Icon = getSubjectIconName(detail.subject.title);
  const activeBlockIds = new Set(detail.activeBlocks.map((block) => block.id));
  const officialBlockIds = new Set(detail.officialBlocks.map((block) => block.id));
  // Documents are routed to EXACTLY ONE bucket by the admin's meta.section choice:
  //   section="notes" → Notes & Documents
  //   section="qbank" → Active QBank Documents
  // A lesson that was promoted into `activeBlocks` because it has extracted questions
  // is ALSO surfaced in the Active QBank Documents section so the student can open
  // the source file directly — no duplication, no hiding.
  const notesDocuments = detail.documents.filter((doc) => classifyDocumentSection(doc as SubjectLesson) === "notes" && !activeBlockIds.has(doc.id) && !officialBlockIds.has(doc.id));
  const activeQbankDocuments = detail.documents.filter((doc) => classifyDocumentSection(doc as SubjectLesson) === "active-qbank" && !activeBlockIds.has(doc.id));
  const activeBlocksWithoutDoc = detail.activeBlocks.filter((block) => !activeQbankDocuments.find((d) => d.id === block.id));
  const activeQbankDocumentsForRender: SubjectLesson[] = [
    ...activeQbankDocuments,
    ...activeBlocksWithoutDoc.map((b) => ({ id: b.id, title: b.title } as unknown as SubjectLesson)),
  ];

  const qbankConfigHref = `/qbank/configure?subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(exam)}&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${exam}`)}`;
  const randomQuizHref = `/qbank/configure?subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(exam)}&mode=random&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${exam}`)}`;
  const incorrectHref = `/qbank/configure?subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(exam)}&filter=incorrect&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${exam}`)}`;
  const bookmarkedHref = `/qbank/configure?subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(exam)}&filter=bookmarked&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${exam}`)}`;

  // ── Fetch user-specific data ─────────────────────────────────────────────
  const admin = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [sessionsRes, attemptsRes, flashcardReviewsRes] = await Promise.all([
    admin
      .from("quiz_sessions_ext")
      .select("id,mode,subject_title,question_count,current_index,status,score_pct,seconds_elapsed,created_at,completed_at")
      .eq("user_id", ctx.user.id)
      .ilike("subject_title", `%${detail.subject.title}%`)
      .in("status", ["active", "suspended", "complete"])
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("question_attempts")
      .select("correct,created_at")
      .eq("user_id", ctx.user.id)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false }),
    admin
      .from("flashcard_reviews")
      .select("flashcard_id,due_at,repetitions")
      .eq("user_id", ctx.user.id),
  ]);

  const sessions = (sessionsRes.data ?? []) as QuizSession[];
  const todayAttempts = (attemptsRes.data ?? []) as AttemptRow[];
  const flashcardReviews = (flashcardReviewsRes.data ?? []) as FlashcardReviewRow[];
  const blockLessonIds = [...new Set(detail.qbankSources.map((src) => src.id).filter(Boolean))];
  const blockLessonIdSet = new Set(blockLessonIds);
  const { data: blockAttemptRowsData } = blockLessonIds.length
    ? await admin
        .from("question_attempts")
        .select("question_id,correct,questions(lesson_id)")
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(5000)
    : { data: [] as BlockAttemptRow[] };

  // ── Today stats ────────────────────────────────────────────────────────────
  const todayCorrect = todayAttempts.filter((a) => a.correct).length;
  const todayAccuracy = todayAttempts.length ? Math.round((todayCorrect / todayAttempts.length) * 100) : 0;
  const todayGoal = 20; // questions per day goal
  const todayProgress = Math.min(100, Math.round((todayAttempts.length / todayGoal) * 100));
  const todayStudySecs = sessions
    .filter((s) => s.created_at >= today.toISOString())
    .reduce((sum, s) => sum + (s.seconds_elapsed ?? 0), 0);

  // ── Session state ──────────────────────────────────────────────────────────
  const latestSession = sessions[0] ?? null;
  const lastStudiedText = latestSession ? timeAgo(latestSession.created_at) : null;
  const hasSuspendedSession = sessions.some((s) => s.status === "suspended" || s.status === "active");
  const suspendedSession = sessions.find((s) => s.status === "suspended" || s.status === "active");

  // ── Overall subject progress ───────────────────────────────────────────────
  const completeSessions = sessions.filter((s) => s.status === "complete");
  const attemptedByLesson = new Map<string, Set<string>>();
  const correctByLesson = new Map<string, Set<string>>();
  for (const row of (blockAttemptRowsData ?? []) as BlockAttemptRow[]) {
    const lessonId = row.questions?.lesson_id ?? null;
    const questionId = row.question_id ?? null;
    if (!lessonId || !questionId || !blockLessonIdSet.has(lessonId)) continue;
    const attemptedSet = attemptedByLesson.get(lessonId) ?? new Set<string>();
    attemptedSet.add(questionId);
    attemptedByLesson.set(lessonId, attemptedSet);
    if (row.correct) {
      const correctSet = correctByLesson.get(lessonId) ?? new Set<string>();
      correctSet.add(questionId);
      correctByLesson.set(lessonId, correctSet);
    }
  }
  const allAttemptedQuestionIds = new Set<string>();
  for (const set of attemptedByLesson.values()) {
    set.forEach((id) => allAttemptedQuestionIds.add(id));
  }
  const subjectProgressPct = detail.qbankQuestionCount > 0
    ? Math.min(100, Math.round((allAttemptedQuestionIds.size / detail.qbankQuestionCount) * 100))
    : 0;

  function getBlockMetrics(blockId: string, questionCount: number) {
    const attemptedCount = attemptedByLesson.get(blockId)?.size ?? 0;
    const correctCount = correctByLesson.get(blockId)?.size ?? 0;
    const displayPct = questionCount > 0 ? Math.min(100, Math.round((attemptedCount / questionCount) * 100)) : 0;
    const lastScore = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : null;
    const blockStatus: "new" | "suspended" | "complete" = attemptedCount <= 0 ? "new" : attemptedCount >= questionCount ? "complete" : "suspended";
    return { attemptedCount, correctCount, displayPct, lastScore, blockStatus };
  }

  // ── Flashcard SRS stats ────────────────────────────────────────────────────
  const now = new Date();
  const reviewedIds = new Set(flashcardReviews.map((r) => r.flashcard_id));
  const totalCards = detail.keyPoints.length;
  const subjectCardIds = new Set(detail.keyPoints.map((c) => c.id));
  const subjectReviews = flashcardReviews.filter((r) => subjectCardIds.has(r.flashcard_id));
  const masteredCards = subjectReviews.filter((r) => r.repetitions >= 3).length;
  const dueCards = subjectReviews.filter((r) => new Date(r.due_at) <= now).length;
  const newCards = totalCards - subjectReviews.length;

  return (
    <div className="page-shell pb-12">
      {/* Back link */}
      <Link
        href="/courses/darwish-ifom-cse-program"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
      >
        <ChevronLeft className="h-4 w-4" /> Back to IFOM subjects
      </Link>

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-3xl border border-ink-800 bg-[radial-gradient(ellipse_at_top_left,_rgba(79,140,255,0.18),_rgba(8,15,30,0.98)_65%)] overflow-hidden">
        <div className={`h-1.5 w-full bg-gradient-to-r ${detail.subject.accentBar}`} />
        <div className="p-6">
          {/* Subject identity */}
          <div className="flex items-center gap-4">
            <div className={`grid h-16 w-16 place-items-center rounded-3xl ${detail.subject.iconWrap} ${detail.subject.iconClass} shrink-0`}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-medium">IFOM CSE · Subject Hub</div>
              <h1 className="text-2xl font-bold text-white leading-tight sm:text-3xl">{detail.subject.title}</h1>
              {lastStudiedText && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-brand" />
                  Last studied: {lastStudiedText}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{detail.subject.description}</p>

          {/* Overall progress bar */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-brand" />
                Subject Progress
              </span>
              <span className="font-semibold text-white">{subjectProgressPct}%</span>
            </div>
            <ProgressBar pct={subjectProgressPct} color="bg-gradient-to-r from-brand to-blue-400" />
            <div className="mt-1 text-[11px] text-slate-500">
              {completeSessions.length} session{completeSessions.length !== 1 ? "s" : ""} completed · {detail.qbankQuestionCount} total questions available
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Videos" value={detail.videos.length} color="text-fuchsia-300" />
            <StatPill label="Notes" value={notesDocuments.length} color="text-cyan-300" />
            <StatPill label="Questions" value={detail.qbankQuestionCount} color="text-amber-300" />
            <StatPill label="Flashcards" value={totalCards} color="text-emerald-300" />
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-3">
            {hasSuspendedSession && suspendedSession ? (
              <Link
                href={`/qbank?session=${suspendedSession.id}`}
                className="btn-primary gap-2 text-base py-2.5 px-5"
              >
                <Zap className="h-5 w-5" />
                Continue Studying
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  Q{suspendedSession.current_index + 1}/{suspendedSession.question_count}
                </span>
              </Link>
            ) : (
              <Link href={qbankConfigHref} className="btn-primary gap-2 text-base py-2.5 px-5">
                <Zap className="h-5 w-5" />
                Start Studying
              </Link>
            )}
            <Link href="/ifom" className="btn-ghost">
              <MonitorPlay className="h-4 w-4" /> IFOM Exam
            </Link>
          </div>
        </div>
      </div>

      {/* ── TODAY'S DASHBOARD ────────────────────────────────────────────── */}
      <div className="mt-5 rounded-3xl border border-ink-800 bg-ink-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-white">Today</span>
          </div>
          {todayAttempts.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Flame className="h-3.5 w-3.5" />
              {todayAttempts.length}/{todayGoal} goal
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TodayCard
            icon={<Target className="h-4 w-4 text-brand" />}
            label="Questions"
            value={todayAttempts.length}
            sub={`Goal: ${todayGoal}`}
          />
          <TodayCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            label="Accuracy"
            value={todayAttempts.length ? `${todayAccuracy}%` : "—"}
            sub={todayAttempts.length ? `${todayCorrect} correct` : "No attempts yet"}
          />
          <TodayCard
            icon={<Clock className="h-4 w-4 text-amber-400" />}
            label="Study Time"
            value={secondsToTime(todayStudySecs)}
            sub="Today's sessions"
          />
          <TodayCard
            icon={<Activity className="h-4 w-4 text-cyan-400" />}
            label="Daily Goal"
            value={`${todayProgress}%`}
            sub={todayProgress >= 100 ? "🎉 Goal reached!" : `${todayGoal - todayAttempts.length} left`}
          />
        </div>
        {/* Daily goal progress bar */}
        {todayGoal > 0 && (
          <div className="mt-3">
            <ProgressBar
              pct={todayProgress}
              color={todayProgress >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-amber-500 to-amber-400"}
            />
          </div>
        )}
      </div>

      {/* ── START PRACTICING (prominent) ─────────────────────────────────── */}
      <div className="mt-4 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-300 shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold text-white">Practice Questions</div>
            <div className="text-xs text-slate-400">{detail.qbankQuestionCount} questions tagged · choose your mode</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={qbankConfigHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-300 transition"
          >
            <HelpCircle className="h-4 w-4" /> Start Practicing
          </Link>
          <Link
            href={randomQuizHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-slate-300 hover:border-amber-400/50 hover:text-white transition"
          >
            <Zap className="h-4 w-4 text-amber-400" /> Random Quiz
          </Link>
          <Link
            href={incorrectHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-slate-300 hover:border-red-400/50 hover:text-white transition"
          >
            <RotateCcw className="h-4 w-4 text-red-400" /> Incorrect Only
          </Link>
          <Link
            href={bookmarkedHref}
            className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-slate-300 hover:border-brand/50 hover:text-white transition"
          >
            <Bookmark className="h-4 w-4 text-brand" /> Bookmarked
          </Link>
        </div>

        {/* Active QBank — its own dedicated section */}
        {detail.activeBlocks && detail.activeBlocks.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(16,185,129,0.20)", color: "#6ee7b7" }}>Active</span>
                <div className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">Active QBank Files</div>
              </div>
              <div className="text-xs text-emerald-200/80">{detail.activeBlocks.length} files · {detail.activeBlockQuestionTotal} questions</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detail.activeBlocks.map((block) => (
                <Link
                  key={block.id}
                  href={`/qbank?block=${block.id}&blockTitle=${encodeURIComponent(block.title)}&subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(detail.exam)}&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${detail.exam}`)}`}
                  className="group rounded-xl border border-emerald-400/25 bg-ink-950/40 p-3 hover:border-emerald-400/60 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: "rgba(16,185,129,0.25)", color: "#6ee7b7" }}>{block.blockNumber}</span>
                    <span className="text-sm font-semibold text-white truncate flex-1">{block.title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-ink-950/60 py-1.5">
                      <div className="text-base font-bold text-white">{block.questionCount}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Questions</div>
                    </div>
                    <div className="rounded-lg bg-ink-950/60 py-1.5">
                      <div className="text-base font-bold text-emerald-300">~{Math.round(block.questionCount * 1.5)}m</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Duration</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active QBank Documents — moved out of Start Practicing (its own dedicated section is rendered below) */}

        {/* Official Fixed Blocks — distinct from practice pool */}
        {detail.officialBlocks.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(220,38,38,0.2)", color: "#fca5a5" }}>Official</span>
                <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">Fixed QBank Blocks</div>
              </div>
              <div className="text-xs text-slate-400">{detail.officialBlocks.length} blocks · {detail.officialBlockQuestionTotal} questions</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 flex-row-reverse" style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", direction: "rtl" }}>
              {detail.officialBlocks.map((block) => (
                <Link
                  key={block.id}
                  href={`/qbank?block=${block.id}&blockTitle=${encodeURIComponent(block.title)}&subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(detail.exam)}&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${detail.exam}`)}`}
                  className="shrink-0 flex flex-col rounded-2xl border-2 p-4 hover:scale-[1.02] transition"
                  style={{ width: "240px", minWidth: "240px", scrollSnapAlign: "start", background: "linear-gradient(135deg, rgba(220,38,38,0.12) 0%, rgba(15,23,42,0.95) 100%)", borderColor: "rgba(220,38,38,0.45)" }}
                  dir="rtl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold" style={{ background: "rgba(220,38,38,0.25)", color: "#fca5a5" }}>{block.blockNumber}</span>
                    <span className="text-sm font-semibold text-white truncate flex-1">{block.title}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-ink-900 px-2 py-1.5 text-center">
                      <div className="text-base font-bold text-white">{block.questionCount}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Questions</div>
                    </div>
                    <div className="rounded-xl bg-ink-900 px-2 py-1.5 text-center">
                      <div className="text-base font-bold text-red-300">~{Math.round(block.questionCount * 1.5)}m</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Est. Time</div>
                    </div>
                  </div>
                  <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold" style={{ background: "rgba(220,38,38,0.12)", borderColor: "rgba(220,38,38,0.5)", color: "#fca5a5" }}>
                    <ChevronLeft className="h-3.5 w-3.5" /> ابدأ البلوك
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── ACTIVE QBANK DOCUMENTS (dedicated section, exclusive to admin's upload choice) ── */}
      {activeQbankDocumentsForRender.length > 0 && (
        <section className="mt-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 shrink-0">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-semibold text-white">Active QBank Documents</div>
                <div className="text-xs text-slate-400">
                  {activeQbankDocumentsForRender.length} document{activeQbankDocumentsForRender.length !== 1 ? "s" : ""} · routed here because the educator chose <span className="text-emerald-300 font-semibold">Active QBank</span>
                </div>
              </div>
            </div>
            <span className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(16,185,129,0.20)", color: "#6ee7b7" }}>
              Active
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeQbankDocumentsForRender.map((doc, index) => {
              const linkedBlock = activeBlocksWithoutDoc.find((b) => b.id === doc.id);
              const href = linkedBlock
                ? `/qbank?block=${doc.id}&blockTitle=${encodeURIComponent(linkedBlock.title)}&subject=${encodeURIComponent(detail.subject.title)}&exam=${encodeURIComponent(detail.exam)}&returnTo=${encodeURIComponent(`/subjects/${detail.subject.slug}?exam=${detail.exam}`)}`
                : `/lesson/${doc.id}`;
              return (
                <Link
                  key={doc.id}
                  href={href}
                  className="group rounded-xl border border-emerald-400/25 bg-ink-950/40 p-3 hover:border-emerald-400/60 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
                          style={{ background: "rgba(16,185,129,0.25)", color: "#6ee7b7" }}>{index + 1}</span>
                    <span className="text-sm font-semibold text-white truncate flex-1">{friendlyDocTitle(doc.title, index + 1)}</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {linkedBlock && linkedBlock.questionCount > 0
                      ? `Active QBank block · ${linkedBlock.questionCount} questions`
                      : "Open active QBank HTML document"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── SECTIONS GRID ────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-4">

        {/* 1. Video Lectures */}
        <ExpandableSection
          colorClass="bg-fuchsia-500/10 text-fuchsia-300"
          icon={<PlaySquare className="h-6 w-6" />}
          title="Video Lectures"
          count={detail.videos.length}
          meta={
            detail.videos.length > 0
              ? `${detail.videos.length} recorded session${detail.videos.length !== 1 ? "s" : ""}`
              : "No sessions linked yet"
          }
          cta="Watch Now"
          ctaHref={detail.videos[0] ? `/lesson/${detail.videos[0].id}` : "#"}
          sectionKey="videos"
        >
          <div className="flex flex-col gap-3">
            {detail.videos.map((video, index) => {
              const provider = typeof video.meta?.provider === "string" ? String(video.meta.provider) : "";
              const externalUrl = typeof video.meta?.url === "string" ? String(video.meta.url) : "";
              return (
                <div key={video.id} className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-950/60 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300 shrink-0">
                    <PlaySquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {conciseTitle("video", index + 1, video.title)}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{video.title}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/lesson/${video.id}`} className="btn-primary text-xs py-1 px-3">
                      Watch
                    </Link>
                    {externalUrl && (
                      <a href={externalUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-1 px-3">
                        <ExternalLink className="h-3 w-3" /> {externalLabel(provider)}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableSection>

        {/* 2. Notes & Documents */}
        <ExpandableSection
          colorClass="bg-cyan-500/10 text-cyan-300"
          icon={<FileText className="h-6 w-6" />}
          title="Notes & Documents"
          count={notesDocuments.length}
          meta={
            notesDocuments.length > 0
              ? `${notesDocuments.length} review document${notesDocuments.length !== 1 ? "s" : ""}`
              : "No notes linked yet"
          }
          cta="View Notes"
          ctaHref={notesDocuments[0] ? `/lesson/${notesDocuments[0].id}` : "#"}
          sectionKey="notes"
        >
          <div className="flex flex-col gap-2">
            {notesDocuments.map((doc, index) => (
              <Link
                key={doc.id}
                href={`/lesson/${doc.id}`}
                className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 hover:border-cyan-400/40 transition"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {friendlyDocTitle(doc.title, index + 1)}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{conciseTitle("notes", index + 1, doc.title)}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 shrink-0" />
              </Link>
            ))}
          </div>
        </ExpandableSection>

        {/* 3. Flashcards with SRS stats */}
        <ExpandableSection
          colorClass="bg-emerald-500/10 text-emerald-300"
          icon={<Brain className="h-6 w-6" />}
          title="High-Yield Flashcards"
          count={totalCards}
          meta={
            totalCards > 0
              ? `${dueCards} due · ${masteredCards} mastered · ${newCards} new`
              : "No flashcards linked yet"
          }
          cta="Review Today's Cards"
          ctaHref="/flashcards/review"
          sectionKey="flashcards"
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total" value={totalCards} color="text-white" />
            <StatPill label="Due Today" value={dueCards} color="text-amber-300" />
            <StatPill label="Mastered" value={masteredCards} color="text-emerald-300" />
            <StatPill label="New" value={newCards} color="text-cyan-300" />
          </div>
          {totalCards > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                <span>Mastery Progress</span>
                <span>{totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0}%</span>
              </div>
              <ProgressBar pct={totalCards > 0 ? (masteredCards / totalCards) * 100 : 0} color="bg-emerald-500" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.keyPoints.slice(0, 6).map((card) => {
              const title = card.front.replace(/:\s*High-yield point\s*\d+/i, "").trim() || card.front;
              const body =
                card.back
                  .split(/\n+/)
                  .map((l) => l.replace(/^[-•\s]+/, "").trim())
                  .filter(Boolean)[0] ?? card.back;
              const reviewed = reviewedIds.has(card.id);
              return (
                <div key={card.id} className={`rounded-2xl border ${reviewed ? "border-emerald-400/20 bg-emerald-500/5" : "border-ink-700 bg-ink-950/60"} p-4`}>
                  <div className="flex items-start gap-2">
                    {reviewed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                    <div className="text-sm font-semibold text-white leading-6">{title}</div>
                  </div>
                  <div className="mt-1 text-xs leading-6 text-slate-400 line-clamp-2">{body}</div>
                </div>
              );
            })}
            {totalCards > 6 && (
              <div className="sm:col-span-2 text-center text-xs text-slate-500 pt-1">
                + {totalCards - 6} more ·{" "}
                <Link href="/flashcards/review" className="text-brand hover:underline">
                  Review all cards
                </Link>
              </div>
            )}
          </div>
        </ExpandableSection>

        {/* 4. Progress & Analytics */}
        <div className="rounded-3xl border border-ink-800 bg-ink-900 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand shrink-0">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">Performance &amp; History</div>
              <div className="text-xs text-slate-400">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {completeSessions.length} complete
              </div>
            </div>
          </div>

          {sessions.length > 0 ? (
            <div className="flex flex-col gap-2 mb-4">
              {sessions.slice(0, 5).map((session) => {
                const pct = Math.min(100, Math.round((session.current_index / Math.max(session.question_count, 1)) * 100));
                return (
                  <div key={session.id} className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-950/60 p-3">
                    <div className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                      session.status === "complete" ? "bg-emerald-500/10 text-emerald-400" :
                      session.status === "suspended" ? "bg-amber-500/10 text-amber-400" :
                      "bg-brand/10 text-brand"
                    }`}>
                      {session.status === "complete" ? <CheckCircle2 className="h-4 w-4" /> :
                       session.status === "suspended" ? <Clock className="h-4 w-4" /> :
                       <Activity className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-white">
                          {session.question_count}Q · {session.mode} · {timeAgo(session.created_at)}
                        </span>
                        {session.score_pct != null && (
                          <span className={`text-xs font-bold ${session.score_pct >= 60 ? "text-emerald-400" : "text-red-400"}`}>
                            {Math.round(session.score_pct)}%
                          </span>
                        )}
                      </div>
                      <ProgressBar
                        pct={pct}
                        color={session.status === "complete" ? "bg-emerald-500" : "bg-amber-400"}
                      />
                    </div>
                    {session.status !== "complete" && (
                      <Link href={`/qbank?session=${session.id}`} className="shrink-0 text-xs text-brand hover:underline">
                        Resume
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-ink-700 bg-ink-950/50 p-4 text-center text-sm text-slate-500">
              No sessions yet — start practicing to see your history here
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 text-center">
              <Activity className="h-5 w-5 text-brand" />
              <span className="text-xs text-slate-400">Sessions</span>
              <span className="text-lg font-bold text-white">{sessions.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-xs text-slate-400">Complete</span>
              <span className="text-lg font-bold text-white">{completeSessions.length}</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 text-center">
              <Target className="h-5 w-5 text-amber-400" />
              <span className="text-xs text-slate-400">Best Score</span>
              <span className="text-lg font-bold text-white">
                {completeSessions.length > 0
                  ? `${Math.max(...completeSessions.map((s) => Math.round(s.score_pct ?? 0)))}%`
                  : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-700 bg-ink-950/60 p-3 text-center">
              <BookOpen className="h-5 w-5 text-cyan-400" />
              <span className="text-xs text-slate-400">Study Time</span>
              <span className="text-lg font-bold text-white">
                {secondsToTime(sessions.reduce((sum, s) => sum + (s.seconds_elapsed ?? 0), 0))}
              </span>
            </div>
          </div>

          <Link href="/progress" className="btn-ghost mt-4 text-sm w-full justify-center inline-flex items-center gap-2">
            View Full Analytics <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
