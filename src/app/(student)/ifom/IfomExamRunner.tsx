"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { repairQuestion } from "@/lib/question-normalizer";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Expand,
  FileBarChart2,
  GraduationCap,
  Minimize2,
  PlayCircle,
  TimerReset,
  XCircle,
} from "lucide-react";
import Link from "next/link";

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

type Phase = "overview" | "tutorial" | "session1" | "break" | "session2" | "report";
type AttemptPhase = "tutorial" | "session1" | "session2";
type AnswerMap = Record<string, { chosen: string; correct: boolean; phase: AttemptPhase }>;

const PHASE_SECONDS: Record<Exclude<Phase, "overview" | "report">, number> = {
  tutorial: 15 * 60,
  session1: 120 * 60,
  break: 15 * 60,
  session2: 120 * 60,
};

const TUTORIAL_RULES = [
  "Use the tutorial to understand navigation, answer selection, and timing before the scored blocks.",
  "Session 1 and Session 2 simulate the IFOM flow with one scheduled break in between.",
  "Questions should be read as a clean clinical stem first, then options, then explanation when available.",
  "Use full screen for the closest exam-like experience.",
];

function formatTime(total: number) {
  const safe = Math.max(total, 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)\/?/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function splitExplanation(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) {
    return {
      explanation: "No explanation provided for this question yet.",
      educationalObjective: "",
    };
  }
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "No explanation provided for this question yet.",
    educationalObjective: parts[1]?.trim() || "",
  };
}

function excerpt(value: string, max = 72) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}...` : trimmed;
}

function detectSubject(tags: string[]) {
  return tags.find((tag) => tag && tag !== "IFOM CSE") || "IFOM CSE";
}

function detectTopic(tags: string[]) {
  return tags.filter((tag) => tag && tag !== "IFOM CSE").slice(1, 3).join(" • ") || "Clinical reasoning";
}

function nextPhase(current: Phase): Phase {
  if (current === "tutorial") return "session1";
  if (current === "session1") return "break";
  if (current === "session2") return "report";
  return current;
}

function StageCard({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">{icon}</div>
      <div className="mt-3 font-semibold text-slate-100">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "text-brand" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export default function IfomExamRunner({ questions }: { questions: Question[] }) {
  const tutorialQuestions = useMemo(() => questions.slice(0, 15), [questions]);
  const session1Questions = useMemo(() => questions.slice(0, 80), [questions]);
  const session2Questions = useMemo(() => questions.slice(80, 160), [questions]);
  const availableForFullExam = session1Questions.length + session2Questions.length;
  const subjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    questions.forEach((q) => {
      (q.tags ?? []).forEach((tag) => {
        if (!tag || tag === "IFOM CSE") return;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [questions]);

  const [phase, setPhase] = useState<Phase>("overview");
  const [phaseSeconds, setPhaseSeconds] = useState(PHASE_SECONDS.tutorial);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [immersive, setImmersive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentQuestions = phase === "tutorial" ? tutorialQuestions : phase === "session1" ? session1Questions : phase === "session2" ? session2Questions : [];
  const currentQuestion = currentQuestions[currentIndex];

  useEffect(() => {
    if (phase === "overview" || phase === "report") return;
    setPhaseSeconds(PHASE_SECONDS[phase]);
    setCurrentIndex(0);
    setSelected(null);
    setRevealed(false);
  }, [phase]);

  useEffect(() => {
    const onFullscreenChange = () => setImmersive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!["tutorial", "session1", "break", "session2"].includes(phase)) return;
    const timer = window.setInterval(() => {
      setPhaseSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          if (phase === "tutorial") setPhase("session1");
          if (phase === "session1") setPhase("break");
          if (phase === "break") setPhase("session2");
          if (phase === "session2") setPhase("report");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const tutorialAnswered = tutorialQuestions.filter((q) => answers[q.id]?.phase === "tutorial").length;
  const tutorialCorrect = tutorialQuestions.filter((q) => answers[q.id]?.phase === "tutorial" && answers[q.id]?.correct).length;
  const session1Answered = session1Questions.filter((q) => answers[q.id]?.phase === "session1").length;
  const session2Answered = session2Questions.filter((q) => answers[q.id]?.phase === "session2").length;
  const session1Correct = session1Questions.filter((q) => answers[q.id]?.phase === "session1" && answers[q.id]?.correct).length;
  const session2Correct = session2Questions.filter((q) => answers[q.id]?.phase === "session2" && answers[q.id]?.correct).length;
  const totalAnswered = Object.keys(answers).length;
  const totalCorrect = Object.values(answers).filter((item) => item.correct).length;
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  async function enterImmersiveMode() {
    const node = containerRef.current;
    if (!node) return;
    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen();
      }
      setImmersive(true);
    } catch {
      setImmersive(true);
    }
  }

  async function exitImmersiveMode() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } finally {
      setImmersive(false);
    }
  }

  async function startTutorial() {
    await enterImmersiveMode();
    setPhase("tutorial");
  }

  async function skipTutorial() {
    await enterImmersiveMode();
    setPhase("session1");
  }

  async function recordAttempt(question: Question, chosen: string, sessionPhase: AttemptPhase) {
    const correct = chosen === question.answer_key;
    setAnswers((state) => ({ ...state, [question.id]: { chosen, correct, phase: sessionPhase } }));

    const s = createClient();
    const user = (await s.auth.getUser()).data.user;
    if (user) {
      await s.from("question_attempts").insert({
        user_id: user.id,
        question_id: question.id,
        chosen,
        correct,
        time_ms: 0,
      });
    }
    return correct;
  }

  function resetQuestionUI() {
    setSelected(null);
    setRevealed(false);
  }

  function goToNextQuestion() {
    const nextIndex = currentIndex + 1;
    resetQuestionUI();
    if (nextIndex < currentQuestions.length) {
      setCurrentIndex(nextIndex);
      return;
    }
    setPhase(nextPhase(phase));
  }

  async function submitAnswer() {
    if (!currentQuestion || !selected) return;

    if (phase === "tutorial") {
      if (!answers[currentQuestion.id]) {
        await recordAttempt(currentQuestion, selected, "tutorial");
      }
      setRevealed(true);
      return;
    }

    if (phase === "session1") {
      await recordAttempt(currentQuestion, selected, "session1");
      goToNextQuestion();
      return;
    }

    if (phase === "session2") {
      await recordAttempt(currentQuestion, selected, "session2");
      goToNextQuestion();
    }
  }

  async function restart() {
    setPhase("overview");
    setAnswers({});
    setCurrentIndex(0);
    setSelected(null);
    setRevealed(false);
    setPhaseSeconds(PHASE_SECONDS.tutorial);
    await exitImmersiveMode();
  }

  const wrapperClass = immersive
    ? "fixed inset-0 z-[90] overflow-auto bg-[#040a12] p-4 md:p-6"
    : "space-y-6";

  if (phase === "overview") {
    return (
      <div ref={containerRef} className="space-y-6">
        <div className="card p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            <BookOpenCheck className="h-3.5 w-3.5" /> IFOM CSE Simulator
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white">Structured IFOM question flow</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
            IFOM questions now run in a clean exam layout: question stem first, medical image with the stem when available, answer choices next, and explanation shown in tutorial mode after answering.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <StageCard icon={<GraduationCap className="h-4 w-4" />} title="Tutorial" subtitle="15 min orientation" />
            <StageCard icon={<PlayCircle className="h-4 w-4" />} title="Session 1" subtitle="80 Questions · 120 Minutes" />
            <StageCard icon={<Coffee className="h-4 w-4" />} title="Break" subtitle="15 Minutes" />
            <StageCard icon={<PlayCircle className="h-4 w-4" />} title="Session 2" subtitle="80 Questions · 120 Minutes" />
            <StageCard icon={<FileBarChart2 className="h-4 w-4" />} title="Final Report" subtitle="Performance summary" />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <SummaryCard label="IFOM questions loaded" value={questions.length} />
            <SummaryCard label="Tutorial target" value={15} tone="text-emerald-300" />
            <SummaryCard label="Session 1 pool" value={session1Questions.length} tone="text-cyan-300" />
            <SummaryCard label="Session 2 pool" value={session2Questions.length} tone="text-fuchsia-300" />
          </div>

          {availableForFullExam < 160 ? (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-200">
              The IFOM simulator is active, but the current database contains fewer than 160 IFOM questions. The layout is still fixed and the available pool will be used.
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-ink-800 bg-ink-900/70 p-5">
            <div className="text-sm font-semibold text-white">Tutorial instructions</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300 marker:text-brand">
              {TUTORIAL_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          {subjectCounts.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {subjectCounts.map(([subject, count]) => (
                <span key={subject} className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs text-slate-300">
                  {subject}: <span className="text-brand">{count}</span>
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => void startTutorial()}>
              <Expand className="h-4 w-4" /> Start tutorial in full screen
            </button>
            <button className="btn-ghost" onClick={() => void skipTutorial()}>
              Skip tutorial and start Session 1
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "break") {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <div className="card p-8 text-center">
          <div className="flex justify-end">
            <button className="subject-tab" onClick={() => void exitImmersiveMode()}>
              <Minimize2 className="h-4 w-4" /> Exit full screen
            </button>
          </div>
          <div className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full bg-brand/10 text-brand">
            <Coffee className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-3xl font-bold">Scheduled Break</h2>
          <p className="mt-3 text-lg text-slate-400">Take the planned 15-minute break before Session 2.</p>
          <div className="mt-6 text-5xl font-bold text-brand">{formatTime(phaseSeconds)}</div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <SummaryCard label="Session 1 answered" value={session1Answered} />
            <SummaryCard label="Session 1 correct" value={session1Correct} tone="text-emerald-300" />
            <SummaryCard label="Session 1 accuracy" value={`${session1Answered ? Math.round((session1Correct / session1Answered) * 100) : 0}%`} tone="text-cyan-300" />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn-primary" onClick={() => setPhase("session2")}>Start Session 2 now</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "report") {
    const reviewedQuestions = [...tutorialQuestions, ...session1Questions, ...session2Questions].filter((q) => answers[q.id]);
    return (
      <div ref={containerRef} className={wrapperClass}>
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Final Report
              </div>
              {immersive ? (
                <button className="subject-tab" onClick={() => void exitImmersiveMode()}>
                  <Minimize2 className="h-4 w-4" /> Exit full screen
                </button>
              ) : null}
            </div>
            <h2 className="mt-4 text-3xl font-bold">IFOM CSE session summary</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              <SummaryCard label="Answered" value={totalAnswered} />
              <SummaryCard label="Correct" value={totalCorrect} tone="text-emerald-300" />
              <SummaryCard label="Accuracy" value={`${overallAccuracy}%`} tone="text-cyan-300" />
              <SummaryCard label="Tutorial" value={`${tutorialCorrect}/${tutorialAnswered || 0}`} tone="text-emerald-300" />
              <SummaryCard label="Session 1 + 2" value={`${session1Correct + session2Correct}/${session1Answered + session2Answered || 0}`} tone="text-fuchsia-300" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => void restart()}><TimerReset className="h-4 w-4" /> Restart simulator</button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-xl font-semibold">Question review</h3>
            <div className="mt-4 space-y-3">
              {reviewedQuestions.length ? reviewedQuestions.map((q, index) => {
                const answer = answers[q.id];
                const details = splitExplanation(q.explanation);
                return (
                  <div key={q.id} className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-medium text-slate-100">{index + 1}. {q.stem}</div>
                      <span className={`inline-flex items-center gap-1 text-sm ${answer?.correct ? "text-emerald-300" : "text-red-300"}`}>
                        {answer?.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {answer?.correct ? "Correct" : `Incorrect · correct answer ${q.answer_key}`}
                      </span>
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Your answer: {answer?.chosen}</div>
                    <div className="mt-3 text-sm leading-7 text-slate-300">{details.explanation}</div>
                  </div>
                );
              }) : <div className="text-sm text-slate-500">No answered questions were recorded in this run.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rawQ = currentQuestion;
  const q = rawQ ? repairQuestion(rawQ) : rawQ;
  const imageHref = assetHref(q?.image_path);
  const details = splitExplanation(q?.explanation);
  const progressWidth = currentQuestions.length ? `${((currentIndex + 1) / currentQuestions.length) * 100}%` : "0%";
  const subject = detectSubject(q?.tags ?? []);
  const topic = detectTopic(q?.tags ?? []);
  const headerPreview = excerpt(q?.stem ?? "");

  return (
    <div ref={containerRef} className={wrapperClass}>
      <div className={immersive ? "mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 pt-2" : "space-y-5"}>
        <div className="sticky top-0 z-30 overflow-hidden rounded-[28px] border border-ink-800 bg-[#07111f]/95 backdrop-blur-xl">
          <div className="px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
              <Link href="/ifom" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-ink-700 bg-ink-900 text-slate-300 transition hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm font-semibold text-slate-200">
                <Clock3 className="h-4 w-4 text-brand" />
                <span>{formatTime(phaseSeconds)}</span>
              </div>

              <div className="min-w-[96px] text-center text-base font-semibold text-slate-200 sm:text-lg">
                Q{Math.min(currentIndex + 1, currentQuestions.length || 1)} / {currentQuestions.length || 0}
              </div>

              <div className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                {phase === "tutorial" ? "Tutorial" : phase === "session1" ? "Session 1" : "Session 2"}
              </div>

              {immersive ? (
                <button className="subject-tab" onClick={() => void exitImmersiveMode()}>
                  <Minimize2 className="h-4 w-4" /> Exit full screen
                </button>
              ) : null}
            </div>
          </div>

          <div className="h-1 w-full bg-ink-800">
            <div className="h-full bg-gradient-to-r from-emerald-400 via-brand to-cyan-400 transition-all duration-300" style={{ width: progressWidth }} />
          </div>
        </div>

        {!immersive ? (
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Current question" value={`${Math.min(currentIndex + 1, currentQuestions.length || 0)}/${currentQuestions.length || 0}`} />
            <SummaryCard label="Answered" value={phase === "tutorial" ? tutorialAnswered : phase === "session2" ? session2Answered : session1Answered} tone="text-cyan-300" />
            <SummaryCard label="Correct" value={phase === "tutorial" ? tutorialCorrect : phase === "session2" ? session2Correct : session1Correct} tone="text-emerald-300" />
            <SummaryCard label="Overall accuracy" value={`${overallAccuracy}%`} tone="text-fuchsia-300" />
          </div>
        ) : null}

        {q ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-ink-700 bg-[#152236] px-3 py-1 text-xs font-medium text-slate-300">IFOM CSE</span>
              <span className="rounded-full border border-ink-700 bg-[#152236] px-3 py-1 text-xs font-medium text-slate-300">{subject}</span>
              {q.difficulty ? <span className="rounded-full border border-ink-700 bg-[#152236] px-3 py-1 text-xs font-medium text-slate-300">{q.difficulty}</span> : null}
            </div>

            <div className="text-lg font-medium leading-8 text-emerald-400">Question {currentIndex + 1} · {headerPreview}</div>

            <div className="rounded-[28px] border border-ink-800 bg-[#0b1322] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] md:p-6">
              <div className="text-[2.05rem] leading-[1.7] font-medium text-white max-md:text-[1.05rem] max-md:leading-9">{q.stem}</div>

              {imageHref ? (
                <div className="mt-5 overflow-hidden rounded-[24px] border border-cyan-400/15 bg-black">
                  <img src={imageHref} alt={q.image_caption || "Question visual"} className="max-h-[420px] w-full object-contain" />
                  {q.image_caption ? <div className="border-t border-white/10 px-4 py-3 text-sm text-slate-300">{q.image_caption}</div> : null}
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                {q.choices.map((choice) => {
                  const isPicked = selected === choice.key;
                  const isCorrect = choice.key === q.answer_key;
                  let btnClass = "w-full block rounded-[22px] border border-[#31455d] bg-[#152236] px-5 py-5 text-left transition";
                  if (phase === "tutorial" && revealed) {
                    if (isCorrect) btnClass += " border-emerald-500/40 bg-emerald-500/12";
                    else if (isPicked) btnClass += " border-rose-500/40 bg-rose-500/12";
                  } else if (isPicked) {
                    btnClass += " border-brand bg-brand/10";
                  }

                  return (
                    <button key={choice.key} onClick={() => !revealed && setSelected(choice.key)} className={btnClass} disabled={phase === "tutorial" ? revealed : false}>
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-white/80 text-lg font-semibold text-white">
                          {choice.key}
                        </div>
                        <div className="flex-1 text-base leading-8 text-slate-100 max-md:text-[1.02rem] max-md:leading-7">{choice.text}</div>
                        {phase === "tutorial" && revealed && isCorrect ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" /> : null}
                        {phase === "tutorial" && revealed && isPicked && !isCorrect ? <XCircle className="h-6 w-6 shrink-0 text-rose-400" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {phase === "tutorial" && revealed ? (
              <div className="rounded-[24px] border border-emerald-500/30 bg-[rgba(20,83,45,0.38)] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" /> {selected === q.answer_key ? "Correct!" : "Review"}
                </h3>
                <div className="mb-3 text-sm font-semibold text-white">Correct Answer: {q.answer_key}</div>
                <div className="space-y-4 whitespace-pre-wrap text-sm leading-7 text-slate-100">{details.explanation}</div>
                {details.educationalObjective ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-7 text-emerald-50">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">Educational Objective</div>
                    {details.educationalObjective}
                  </div>
                ) : null}
                <div className="mt-4 text-xs text-emerald-100/85">Subject: {subject} | Topic: {topic}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {phase === "tutorial" ? (
                revealed ? (
                  <button className="btn-primary" onClick={goToNextQuestion}>
                    Next Question <ChevronRight className="ml-1 h-5 w-5" />
                  </button>
                ) : (
                  <button className="btn-primary" disabled={!selected} onClick={() => void submitAnswer()}>
                    Check Answer
                  </button>
                )
              ) : (
                <button className="btn-primary" disabled={!selected} onClick={() => void submitAnswer()}>
                  Submit Answer
                </button>
              )}

              {phase === "tutorial" ? (
                <button className="btn-ghost" onClick={() => void skipTutorial()}>
                  Skip tutorial and start Session 1
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="card p-8 text-center text-slate-400">No questions are available for this stage yet.</div>
        )}
      </div>
    </div>
  );
}
