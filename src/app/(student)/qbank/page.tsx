"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  BookOpenCheck,
  AlertCircle,
  Clock,
  RotateCcw,
  Target,
  Flame,
  Bookmark,
  Shuffle,
  XCircle,
  Plus,
  Layers3,
  Brain,
  FolderTree,
  ScanSearch,
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
  video_url?: string | null;
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

type SavedSession = {
  id: string;
  mode: string;
  exam_code: string;
  subject_title: string | null;
  question_count: number;
  current_index: number;
  question_ids?: string[];
  status: "active" | "suspended" | "complete";
  score_pct: number | null;
  seconds_elapsed: number;
  created_at: string;
  completed_at: string | null;
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

function StatCard({ icon, label, value, sub, color }: { icon: ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-[24px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--c-text-4)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
      {sub ? <div className="mt-1 text-xs" style={{ color: "var(--c-text-4)" }}>{sub}</div> : null}
    </div>
  );
}

function WorkspacePill({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="rounded-2xl border px-3 py-2.5" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--c-text-2)" }}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--c-text-4)" }}>{meta}</div>
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
  const selectedFilter = sp.get("filter") || "";
  const selectedSessionId = sp.get("session") || "";
  const hasSessionRequest = sp.has("count") || sp.has("mode") || sp.has("difficulty") || Boolean(selectedFilter) || Boolean(selectedSessionId);
  const count = parseInt(sp.get("count") || "20", 10);
  const mode = (sp.get("mode") || "tutor") as "tutor" | "exam" | "timed";
  const difficulty = (sp.get("difficulty") || "all").toLowerCase();
  const fallbackReturnTo = `/qbank?exam=${encodeURIComponent(selectedExam)}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedCourse ? `&course=${encodeURIComponent(selectedCourse)}` : ""}`;
  const returnTo = sp.get("returnTo") || fallbackReturnTo;
  const shouldAutoStart = Boolean(selectedSessionId || ((selectedSubject || selectedCourse || selectedFilter) && hasSessionRequest));

  const [subjects, setSubjects] = useState<SubjectOverview[]>([]);
  const [search, setSearch] = useState("");
  const [session, setSession] = useState<SessionState>({ status: "idle", questions: [], label: "", message: "" });
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

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
    fetch("/api/quiz/sessions")
      .then((r) => r.json())
      .catch(() => ({ sessions: [] }))
      .then((d) => setSavedSessions((d.sessions ?? []) as SavedSession[]));
  }, []);

  useEffect(() => {
    const label = selectedSessionId
      ? "Resumed Session"
      : selectedSubject || (selectedCourse ? "Course Session" : selectedFilter ? `${selectedFilter[0]?.toUpperCase() || ""}${selectedFilter.slice(1)} Session` : "");

    if (!shouldAutoStart) {
      setSession({ status: "idle", questions: [], label: "", message: "" });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setSession((prev) => ({ status: "loading", questions: prev.label === label ? prev.questions : [], label, message: "" }));

    const load = async () => {
      try {
        if (selectedSessionId) {
          const response = await fetch(`/api/quiz/sessions/${encodeURIComponent(selectedSessionId)}`, { signal: controller.signal });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to resume this session.");
          const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
          if (!active) return;
          setSession({
            status: nextQuestions.length ? "ready" : "empty",
            questions: nextQuestions,
            label: data.session?.subject_title || label || selectedSubject || "Resumed Session",
            message: nextQuestions.length ? "" : "This saved session has no available questions.",
          });
          return;
        }

        const params = new URLSearchParams();
        if (selectedSubject) params.set("subject", selectedSubject);
        if (selectedCourse) params.set("course", selectedCourse);
        if (selectedExam) params.set("exam", selectedExam);
        if (selectedFilter) params.set("filter", selectedFilter);
        params.set("count", String(count));
        if (difficulty && difficulty !== "all") params.set("difficulty", difficulty);

        const response = await fetch(`/api/questions/filter?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load questions.");
        if (!active) return;
        const nextQuestions = Array.isArray(data.questions) ? data.questions : [];
        setSession({
          status: nextQuestions.length ? "ready" : "empty",
          questions: nextQuestions,
          label,
          message: nextQuestions.length ? "" : "No questions matched the selected filters yet.",
        });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setSession({
          status: "error",
          questions: [],
          label,
          message: error instanceof Error ? error.message : "Unable to start the Q-Bank session.",
        });
      }
    };

    void load();
    return () => { active = false; controller.abort(); };
  }, [selectedSubject, selectedCourse, selectedExam, count, difficulty, shouldAutoStart, selectedFilter, selectedSessionId]);

  const filtered = useMemo(() => {
    return subjects.filter((subject) => `${subject.title} ${subject.description}`.toLowerCase().includes(search.toLowerCase()));
  }, [subjects, search]);

  const totalBlocks = filtered.reduce((acc, subject) => acc + subject.qbankCount, 0);
  const totalResources = filtered.reduce((acc, subject) => acc + subject.videoCount + subject.documentCount + subject.keyPointCount, 0);
  const showRunner = session.questions.length > 0 && (session.status === "ready" || session.status === "loading");

  function scrollCarousel(dir: "left" | "right") {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  if (showRunner) {
    return (
      <QBankRunner
        questions={session.questions}
        mode={mode}
        subjectLabel={session.label || selectedSubject || "Course Session"}
        exam={selectedExam}
        backHref={returnTo}
        sessionId={selectedSessionId || undefined}
      />
    );
  }

  const suspendedSessions = savedSessions.filter((s) => s.status === "suspended" || s.status === "active");
  const completeSessions = savedSessions.filter((s) => s.status === "complete");
  const todayISO = new Date();
  todayISO.setHours(0, 0, 0, 0);
  const todaySessions = savedSessions.filter((s) => new Date(s.created_at) >= todayISO);
  const todayScore = todaySessions.length > 0
    ? Math.round(todaySessions.filter((s) => s.score_pct != null).reduce((sum, s) => sum + (s.score_pct ?? 0), 0) / Math.max(1, todaySessions.filter((s) => s.score_pct != null).length))
    : null;

  return (
    <div className="page-shell pb-32 sm:pb-24">
      <section className="mt-4 overflow-hidden rounded-[32px] border" style={{ background: "linear-gradient(180deg, var(--c-card) 0%, var(--c-surface) 100%)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-elevated)" }}>
        <div className="border-b px-5 py-5 md:px-6" style={{ borderColor: "var(--c-border-subtle)" }}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ borderColor: "rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.08)", color: "var(--c-blue)" }}>
                <Brain className="h-3.5 w-3.5" />
                Clinical Question Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--c-text-1)" }}>
                QBank built for solving questions, not browsing dashboards.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 sm:text-base" style={{ color: "var(--c-text-3)" }}>
                Fixed subject blocks stay organized and reviewable, while random sessions keep your current filters and practice flow intact.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[380px]">
              <WorkspacePill icon={<FolderTree className="h-4 w-4" />} title={`${totalBlocks} fixed blocks`} meta="Organized by subject and source" />
              <WorkspacePill icon={<Shuffle className="h-4 w-4" />} title="Random questions" meta="Same filters, same workflow, faster launch" />
              <WorkspacePill icon={<Layers3 className="h-4 w-4" />} title={`${filtered.length} subjects`} meta="Clinical domains available now" />
              <WorkspacePill icon={<ScanSearch className="h-4 w-4" />} title={`${totalResources} linked resources`} meta="Videos, notes, and key points stay connected" />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 md:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="rounded-[28px] border p-4 sm:p-5" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Fixed Question Blocks</div>
                  <div className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Organized library</div>
                </div>
                <div className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}>
                  {totalBlocks} blocks
                </div>
              </div>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
                Each subject keeps its own question pools and review context. Open the subject to inspect the block list, progress, and linked study resources without disturbing random practice.
              </p>

              <div className="mt-4 relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--c-text-4)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subjects or systems..."
                  className="input h-12 !rounded-[18px] pl-11 text-sm"
                  style={{ borderColor: "var(--c-input-border)", background: "var(--c-input-bg)" }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs" style={{ color: "var(--c-text-4)" }}>{filtered.length} subjects visible</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => scrollCarousel("left")} className="grid h-9 w-9 place-items-center rounded-xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scrollCarousel("right")} className="grid h-9 w-9 place-items-center rounded-xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border p-4 sm:p-5" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "rgba(16,185,129,0.10)", color: "#10b981" }}>
                  <Shuffle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Random Questions</div>
                  <div className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Dynamic practice session</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
                Keep the current filters and launch tutor, timed, or exam-style sessions without touching the original subject blocks.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => router.push(`/qbank?exam=${selectedExam}&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.22)" }}
                >
                  <Shuffle className="h-4 w-4" />
                  Start mixed session
                </button>
                <Link
                  href={`/qbank/configure?exam=${encodeURIComponent(selectedExam)}${selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedFilter ? `&filter=${encodeURIComponent(selectedFilter)}` : ""}&returnTo=${encodeURIComponent(returnTo)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={{ background: "var(--c-elevated)", color: "var(--c-text-2)", border: "1px solid var(--c-border)" }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Configure session
                </Link>
                <button
                  onClick={() => router.push(`/qbank?exam=${selectedExam}&filter=incorrect&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.20)" }}
                >
                  <XCircle className="h-4 w-4" />
                  Incorrect only
                </button>
                <button
                  onClick={() => router.push(`/qbank?exam=${selectedExam}&filter=bookmarked&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={{ background: "rgba(59,130,246,0.08)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.20)" }}
                >
                  <Bookmark className="h-4 w-4" />
                  Bookmarked
                </button>
              </div>
            </div>
          </div>

          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
            {EXAMS.map((exam) => (
              <button
                key={exam.code}
                onClick={() => router.push(`/qbank?exam=${exam.code}`)}
                className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition"
                style={selectedExam === exam.code
                  ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.10)", color: "var(--c-blue)" }
                  : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
              >
                {exam.label}
              </button>
            ))}
          </div>

          {(session.status === "empty" || session.status === "error") && (
            <div className="mt-4 flex items-start gap-3 rounded-[22px] border p-4 text-sm" style={{ borderColor: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.08)", color: "#92400E" }}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#d97706" }} />
              <div>
                <div className="font-semibold" style={{ color: "#b45309" }}>{session.status === "error" ? "Unable to start the session" : "Session did not open"}</div>
                <div className="mt-1">{session.message}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Study Today" value={todaySessions.length > 0 ? `${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""}` : "—"} sub={todaySessions.length > 0 ? "Keep the streak alive" : "No sessions yet"} color="var(--c-text-1)" />
        <StatCard icon={<Target className="h-3.5 w-3.5" />} label="Accuracy" value={todayScore != null ? `${todayScore}%` : "—"} sub={completeSessions.length > 0 ? `${completeSessions.length} completed` : "No data yet"} color={todayScore != null && todayScore >= 60 ? "#22c55e" : todayScore != null ? "#ef4444" : "var(--c-text-1)"} />
        <StatCard icon={<Flame className="h-3.5 w-3.5" />} label="Daily Goal" value={`${Math.min(todaySessions.length, 3)}/3`} sub={todaySessions.length >= 3 ? "Goal reached" : `${3 - todaySessions.length} more to go`} color="#f59e0b" />
        <StatCard icon={<Layers3 className="h-3.5 w-3.5" />} label="Review Sets" value={suspendedSessions.length} sub={suspendedSessions[0] ? "Continue where you stopped" : "Nothing pending"} color="var(--c-blue)" />
      </section>

      {savedSessions.length > 0 && (
        <section className="mt-6 rounded-[28px] border p-4 sm:p-5" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Recent Sessions</div>
              <div className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Pick up exactly where you left off</div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {savedSessions.slice(0, 4).map((s) => {
              const isSuspended = s.status === "suspended" || s.status === "active";
              const isComplete = s.status === "complete";
              const pct = s.current_index && s.question_count ? Math.round((s.current_index / s.question_count) * 100) : 0;
              const date = new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div key={s.id} className="rounded-[24px] border p-4" style={{ background: "var(--c-surface)", borderColor: isSuspended ? "rgba(245,158,11,0.24)" : "var(--c-border)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={isComplete ? { background: "rgba(34,197,94,0.10)", color: "#22c55e" } : { background: "rgba(245,158,11,0.10)", color: "#d97706" }}>
                      {isComplete ? "Complete" : "Resume"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--c-text-4)" }}>{date}</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold leading-6" style={{ color: "var(--c-text-1)" }}>{s.subject_title || s.exam_code}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--c-text-4)" }}>{isComplete ? `${s.score_pct ?? 0}% score` : `Question ${Math.max(1, s.current_index)} of ${s.question_count}`}</div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${isComplete ? 100 : pct}%`, background: isComplete ? "#22c55e" : "#f59e0b" }} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link href={isSuspended ? `/qbank?session=${s.id}` : `/qbank?session=${s.id}&returnTo=${encodeURIComponent(returnTo)}`} className="btn-primary flex-1 text-xs py-2.5">
                      {isComplete ? "Review" : "Continue"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Fixed Blocks Library</div>
            <div className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Subject workspaces</div>
          </div>
          <Link href={`/qbank/configure?exam=${encodeURIComponent(selectedExam)}&returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-2)" }}>
            <Plus className="h-4 w-4" />
            Custom session
          </Link>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[24px] border p-8 text-center text-sm" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", color: "var(--c-text-3)" }}>
            {subjects.length === 0 ? "Loading subjects..." : "No subjects match your search."}
          </div>
        ) : (
          <div ref={carouselRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
            {filtered.map((subject) => {
              const Icon = getSubjectIconName(subject.title);
              return (
                <article key={subject.slug} className="flex w-[310px] shrink-0 flex-col overflow-hidden rounded-[28px] border transition" style={{ scrollSnapAlign: "start", background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
                  <div className={`h-1.5 w-full bg-gradient-to-r ${subject.accentBar}`} />
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] ${subject.iconWrap} ${subject.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>{subject.title}</div>
                        <div className="mt-1 text-xs leading-6" style={{ color: "var(--c-text-4)" }}>{subject.description}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border p-3" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
                        <div className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>{subject.qbankCount}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Blocks / pools</div>
                      </div>
                      <div className="rounded-2xl border p-3" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
                        <div className="text-lg font-bold" style={{ color: "var(--c-blue)" }}>{subject.keyPointCount}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Key points</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full px-2.5 py-1" style={{ background: "var(--c-elevated)", color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}>{subject.videoCount} videos</span>
                      <span className="rounded-full px-2.5 py-1" style={{ background: "var(--c-elevated)", color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}>{subject.documentCount} notes</span>
                    </div>

                    <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                      <button
                        onClick={() => router.push(`/qbank?exam=${encodeURIComponent(selectedExam)}&subject=${encodeURIComponent(subject.title)}&count=20&mode=tutor&returnTo=${encodeURIComponent(fallbackReturnTo)}`)}
                        className="btn-primary text-sm py-2.5"
                      >
                        <BookOpenCheck className="h-4 w-4" />
                        Start mixed
                      </button>
                      <Link href={`/subjects/${subject.slug}?exam=${encodeURIComponent(selectedExam)}`} className="grid h-11 w-11 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }} aria-label={`Open ${subject.title}`}>
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

      {session.status === "loading" && session.questions.length === 0 && shouldAutoStart && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="card p-6 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--c-blue)", borderTopColor: "transparent" }} />
            <p className="mt-3 text-sm" style={{ color: "var(--c-text-3)" }}>Preparing your QBank workspace...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QBankPage() {
  return (
    <Suspense fallback={<div className="page-shell pb-32 sm:pb-24"><div className="mt-20 text-center" style={{ color: "var(--c-text-3)" }}>Loading...</div></div>}>
      <QBankPageInner />
    </Suspense>
  );
}
