"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  PlaySquare,
  FileText,
  Layers,
  Stethoscope,
  BookOpenCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  RotateCcw,
  Target,
  Activity,
  Flame,
  Zap,
  Bookmark,
  Shuffle,
  XCircle,
  Plus,
} from "lucide-react";
import QBankRunner from "./QBankRunner";
import { getSubjectIconName } from "@/lib/subjects";

type Question = {
  id: string;
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string | null;
  difficulty: string;
  tags: string[];
  image_path?: string | null;
  image_caption?: string | null;
};

type SubjectOverview = {
  title: string;
  slug: string;
  description: string;
  accentBar: string;
  iconWrap: string;
  iconClass: string;
  actionClass: string;
  badgeClass: string;
  videoCount: number;
  documentCount: number;
  qbankCount: number;
  keyPointCount: number;
};

type SessionState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  questions: Question[];
  label: string;
  message: string;
};

const EXAMS: { code: string; label: string }[] = [
  { code: "IFOM_CSE", label: "IFOM CSE" },
  { code: "USMLE_CK", label: "USMLE Step 2 CK" },
  { code: "PLAB", label: "PLAB" },
  { code: "AMC", label: "AMC" },
  { code: "SMLE", label: "SMLE" },
  { code: "DHA", label: "DHA" },
  { code: "HAAD", label: "HAAD" },
  { code: "QCHP", label: "QCHP" },
  { code: "PROMETRIC", label: "Prometric" },
];

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-[22px] border p-4"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
    >
      <div className="flex items-center gap-1.5" style={{ color: "var(--c-text-4)" }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "var(--c-text-4)" }}>{sub}</div>}
    </div>
  );
}

function QBankPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const carouselRef = useRef<HTMLDivElement>(null);

  const selectedExam = sp.get("exam") || "IFOM_CSE";
  const selectedSubject = sp.get("subject") || "";
  const selectedCourse = sp.get("course") || "";
  const hasSessionRequest = sp.has("count") || sp.has("mode") || sp.has("difficulty");
  const count = parseInt(sp.get("count") || "20", 10);
  const mode = (sp.get("mode") || "tutor") as "tutor" | "exam" | "timed";
  const difficulty = (sp.get("difficulty") || "all").toLowerCase();
  const fallbackReturnTo = `/qbank?exam=${encodeURIComponent(selectedExam)}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedCourse ? `&course=${encodeURIComponent(selectedCourse)}` : ""}`;
  const returnTo = sp.get("returnTo") || fallbackReturnTo;
  const shouldAutoStart = Boolean((selectedSubject || selectedCourse) && hasSessionRequest);

  const [subjects, setSubjects] = useState<SubjectOverview[]>([]);
  const [search, setSearch] = useState("");
  const [session, setSession] = useState<SessionState>({
    status: "idle",
    questions: [],
    label: "",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;
    setSubjects([]);
    fetch(`/api/subjects/overview?exam=${encodeURIComponent(selectedExam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSubjects(data.subjects ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSubjects([]);
      });
    return () => { cancelled = true; };
  }, [selectedExam]);

  useEffect(() => {
    const label = selectedSubject || (selectedCourse ? "Course Session" : "");
    if (!shouldAutoStart) {
      setSession({ status: "idle", questions: [], label: "", message: "" });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setSession((prev) => ({
      status: "loading",
      questions: prev.label === label ? prev.questions : [],
      label,
      message: "",
    }));
    const params = new URLSearchParams();
    if (selectedSubject) params.set("subject", selectedSubject);
    if (selectedCourse) params.set("course", selectedCourse);
    if (selectedExam) params.set("exam", selectedExam);
    params.set("count", String(count));
    if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);
    fetch(`/api/questions/filter?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load questions.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
        setSession({
          status: nextQuestions.length ? "ready" : "empty",
          questions: nextQuestions,
          label,
          message: nextQuestions.length ? "" : "No questions matched the selected filters yet.",
        });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setSession({
          status: "error",
          questions: [],
          label,
          message: error instanceof Error ? error.message : "Unable to start the Q-Bank session.",
        });
      });
    return () => { active = false; controller.abort(); };
  }, [selectedSubject, selectedCourse, selectedExam, count, difficulty, shouldAutoStart]);

  const filtered = useMemo(() => {
    return subjects.filter((subject) => {
      const haystack = `${subject.title} ${subject.description}`.toLowerCase();
      return !search || haystack.includes(search.toLowerCase());
    });
  }, [subjects, search]);

  const totalQbank = filtered.reduce((acc, subject) => acc + subject.qbankCount, 0);
  const showRunner = session.questions.length > 0 && (session.status === "ready" || session.status === "loading");

  type SavedSession = {
    id: string;
    mode: string;
    exam_code: string;
    subject_title: string | null;
    question_count: number;
    current_index: number;
    status: "active" | "suspended" | "complete";
    score_pct: number | null;
    seconds_elapsed: number;
    created_at: string;
    completed_at: string | null;
  };
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  useEffect(() => {
    fetch("/api/quiz/sessions")
      .then((r) => r.json())
      .catch(() => ({ sessions: [] }))
      .then((d) => setSavedSessions((d.sessions ?? []) as SavedSession[]));
  }, []);

  // Carousel scroll helpers
  function scrollCarousel(dir: "left" | "right") {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -288 : 288, behavior: "smooth" });
  }

  if (showRunner) {
    return (
      <div className="page-shell max-w-none px-0 pb-0 sm:px-0 md:max-w-none md:px-0">
        <QBankRunner
          questions={session.questions}
          mode={mode}
          subjectLabel={session.label || selectedSubject || "Course Session"}
          exam={selectedExam}
          backHref={returnTo}
        />
      </div>
    );
  }

  // Stats from saved sessions
  const suspendedSessions = savedSessions.filter((s) => s.status === "suspended");
  const completeSessions = savedSessions.filter((s) => s.status === "complete");
  const todayISO = new Date();
  todayISO.setHours(0, 0, 0, 0);
  const todaySessions = savedSessions.filter((s) => new Date(s.created_at) >= todayISO);
  const todayScore = todaySessions.length > 0
    ? Math.round(todaySessions.filter((s) => s.score_pct != null).reduce((sum, s) => sum + (s.score_pct ?? 0), 0) / Math.max(1, todaySessions.filter((s) => s.score_pct != null).length))
    : null;

  return (
    <div className="page-shell pb-32 sm:pb-24">

      {/* ── Top Stats Bar ── */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Study Today"
          value={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""}` : "—"}
          sub={todaySessions.length > 0 ? "Keep it up!" : "No sessions yet"}
          color="var(--c-text-1)"
        />
        <StatCard
          icon={<Target className="h-3.5 w-3.5" />}
          label="Accuracy"
          value={todayScore != null ? `${todayScore}%` : "—"}
          sub={completeSessions.length > 0 ? `${completeSessions.length} completed` : "No data yet"}
          color={todayScore != null && todayScore >= 60 ? "#22c55e" : todayScore != null ? "#ef4444" : "var(--c-text-1)"}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Daily Goal"
          value={`${Math.min(todaySessions.length, 3)}/3`}
          sub={todaySessions.length >= 3 ? "Goal reached!" : `${3 - todaySessions.length} more`}
          color="#f59e0b"
        />
        <div
          className="flex flex-col gap-2 rounded-[22px] border p-4"
          style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--c-text-4)" }}>
            Quick Actions
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => router.push(`/qbank?exam=${selectedExam}&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition"
              style={{ background: "rgba(16,185,129,0.10)", color: "#10b981" }}
            >
              <Shuffle className="h-3 w-3" /> Random Quiz
            </button>
            {suspendedSessions[0] && (
              <Link
                href={`/qbank?session=${suspendedSessions[0].id}`}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition"
                style={{ background: "rgba(245,158,11,0.10)", color: "#d97706" }}
              >
                <RotateCcw className="h-3 w-3" /> Resume
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Header card ── */}
      <section
        className="mt-4 overflow-hidden rounded-[30px] border"
        style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:items-center"
          style={{ borderColor: "var(--c-border-subtle)" }}
        >
          <div className="min-w-0 flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
            >
              <Stethoscope className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="break-words text-xl font-bold leading-tight tracking-tight sm:text-2xl" style={{ color: "var(--c-text-1)" }}>
                MEDICAL Q-BANK
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#10b981" }}>
                {totalQbank} active questions
              </div>
            </div>
          </div>
          <Link
            href={`/qbank/configure?exam=${encodeURIComponent(selectedExam)}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedCourse ? `&course=${encodeURIComponent(selectedCourse)}` : ""}&returnTo=${encodeURIComponent(returnTo)}`}
            className="grid h-11 w-11 place-items-center rounded-2xl border transition hover:border-purple-400"
            style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
            aria-label="Configure session"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Link>
        </div>

        <div className="px-5 py-4">
          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push(`/qbank?exam=${selectedExam}&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}
            >
              <Shuffle className="h-4 w-4" /> Random Quiz
            </button>
            <button
              onClick={() => router.push(`/qbank?exam=${selectedExam}&filter=incorrect&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.20)" }}
            >
              <XCircle className="h-4 w-4" /> Incorrect
            </button>
            <button
              onClick={() => router.push(`/qbank?exam=${selectedExam}&filter=bookmarked&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.20)" }}
            >
              <Bookmark className="h-4 w-4" /> Bookmarked
            </button>
            <Link
              href={`/qbank/configure?exam=${encodeURIComponent(selectedExam)}&returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}
            >
              <Plus className="h-4 w-4" /> Custom Quiz
            </Link>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects..."
              className="input h-11 !rounded-[18px] pl-11 text-sm"
              style={{ borderColor: "var(--c-input-border)", background: "var(--c-input-bg)" }}
            />
          </div>

          {/* Exam filter pills */}
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
            {EXAMS.map((exam) => (
              <button
                key={exam.code}
                onClick={() => router.push(`/qbank?exam=${exam.code}`)}
                className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition"
                style={
                  selectedExam === exam.code
                    ? { borderColor: "#10b981", background: "rgba(16,185,129,0.12)", color: "#059669" }
                    : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }
                }
              >
                {exam.label}
              </button>
            ))}
          </div>

          {(session.status === "empty" || session.status === "error") && (
            <div
              className="mt-4 flex items-start gap-3 rounded-[22px] border p-4 text-sm"
              style={{ borderColor: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.08)", color: "#92400E" }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#d97706" }} />
              <div>
                <div className="font-semibold" style={{ color: "#b45309" }}>
                  {session.status === "error" ? "Unable to start the session" : "Session did not open"}
                </div>
                <div className="mt-1">{session.message}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Recent Sessions ── */}
      {savedSessions.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: "var(--c-text-4)" }} />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-3)" }}>
              Recent Sessions
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedSessions.slice(0, 4).map((s) => {
              const isSuspended = s.status === "suspended";
              const isComplete = s.status === "complete";
              const pct = s.current_index && s.question_count
                ? Math.round((s.current_index / s.question_count) * 100)
                : 0;
              const date = new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3.5"
                  style={{ background: "var(--c-card)", borderColor: isSuspended ? "rgba(245,158,11,0.30)" : "var(--c-border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isSuspended ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(245,158,11,0.12)", color: "#d97706" }}>
                          Suspended
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e" }}>
                          Complete
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--c-text-4)" }}>{date}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>
                      {s.subject_title || s.exam_code}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--c-text-4)" }}>
                      {isComplete ? `${s.score_pct ?? 0}% · ${s.question_count} Qs` : `Q${s.current_index} of ${s.question_count} · ${pct}%`}
                    </div>
                    {/* mini progress bar */}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${isComplete ? 100 : pct}%`,
                          background: isComplete ? "#22c55e" : "#f59e0b",
                        }}
                      />
                    </div>
                  </div>
                  {isSuspended ? (
                    <Link
                      href={`/qbank?session=${s.id}`}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.08)", color: "#d97706" }}
                    >
                      <RotateCcw className="h-3 w-3" /> Resume
                    </Link>
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Subjects Horizontal Carousel ── */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-3)" }}>
            Subjects
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--c-text-4)" }}>
              {filtered.length} subjects
            </span>
            <button
              onClick={() => scrollCarousel("left")}
              className="grid h-8 w-8 place-items-center rounded-xl border transition hover:border-green-400"
              style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollCarousel("right")}
              className="grid h-8 w-8 place-items-center rounded-xl border transition hover:border-green-400"
              style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[24px] border p-8 text-center text-sm" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}>
            {subjects.length === 0 ? "Loading subjects..." : "No subjects match your search."}
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          >
            {filtered.map((subject) => {
              const Icon = getSubjectIconName(subject.title);
              return (
                <article
                  key={subject.slug}
                  className="shrink-0 overflow-hidden rounded-[28px] border transition hover:shadow-xl hover:-translate-y-0.5 flex flex-col"
                  style={{
                    width: "260px",
                    scrollSnapAlign: "start",
                    background: "var(--c-card)",
                    borderColor: "var(--c-border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${subject.accentBar}`} />
                  <div className="flex flex-col gap-3 p-4 flex-1">
                    {/* Icon + title */}
                    <div className="flex items-center gap-3">
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[16px] ${subject.iconWrap} ${subject.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{ color: "var(--c-text-1)" }}>{subject.title}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>
                          {subject.qbankCount} Q-Bank blocks
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-2xl border py-2" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
                        <div className="text-base font-bold" style={{ color: "var(--c-text-1)" }}>{subject.qbankCount}</div>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--c-text-4)" }}>Questions</div>
                      </div>
                      <div className="rounded-2xl border py-2" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
                        <div className="text-base font-bold" style={{ color: "#f59e0b" }}>{Math.ceil(subject.qbankCount * 1.5)} min</div>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--c-text-4)" }}>Est. Time</div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--c-elevated)", color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}>
                        {subject.videoCount} videos
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--c-elevated)", color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}>
                        {subject.keyPointCount} cards
                      </span>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          router.push(
                            `/qbank?exam=${encodeURIComponent(selectedExam)}&subject=${encodeURIComponent(subject.title)}&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`,
                          )
                        }
                        className="flex-1 btn-primary text-xs py-2"
                      >
                        <BookOpenCheck className="h-3.5 w-3.5" /> Start
                      </button>
                      <Link
                        href={`/subjects/${subject.slug}?exam=${encodeURIComponent(selectedExam)}`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border transition hover:border-green-400"
                        style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Feature mini cards */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        <FeatureMini icon={<PlaySquare className="h-5 w-5" />} label="Tutor & Exam Modes" color="#2563EB" />
        <FeatureMini icon={<FileText className="h-5 w-5" />} label="Full Explanations" color="#7c3aed" />
        <FeatureMini icon={<Layers className="h-5 w-5" />} label="Progress Tracking" color="#10b981" />
      </section>

      {session.status === "loading" && session.questions.length === 0 && shouldAutoStart && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="card p-6 text-center">
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#10b981", borderTopColor: "transparent" }}
            />
            <p className="mt-3 text-sm" style={{ color: "var(--c-text-3)" }}>Loading questions...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureMini({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div
      className="rounded-[24px] border p-4 text-center"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--c-elevated)", color }}>
        {icon}
      </div>
      <div className="mt-3 text-sm font-medium leading-6" style={{ color: "var(--c-text-2)" }}>{label}</div>
    </div>
  );
}

export default function QBankPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell pb-32 sm:pb-24">
          <div className="mt-20 text-center" style={{ color: "var(--c-text-3)" }}>Loading...</div>
        </div>
      }
    >
      <QBankPageInner />
    </Suspense>
  );
}
