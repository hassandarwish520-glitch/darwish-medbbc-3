"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { repairQuestion } from "@/lib/question-normalizer";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Pause,
  Play,
  BookmarkPlus,
  Highlighter,
  PencilLine,
  XCircle,
  ArrowLeft,
  Bell,
  Target,
  Flag,
  Lightbulb,
  BookOpen,
  ImageIcon,
  Expand,
  Minimize2,
  Plus,
  Minus,
  FolderTree,
  FlaskConical,
  Calculator,
} from "lucide-react";
import Link from "next/link";

type Q = {
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

type Mode = "tutor" | "exam" | "timed";

type Result = {
  id: string;
  chosen: string;
  correct: boolean;
};

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)\/?/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function splitExplanation(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) {
    return { explanation: "", educationalObjective: "" };
  }
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "",
    educationalObjective: parts[1]?.trim() || "",
  };
}

function getTopic(tags: string[]) {
  return tags.filter(Boolean).slice(1, 3).join(" · ") || "Clinical reasoning";
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function excerpt(value: string, max = 60) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}…` : trimmed;
}

function difficultyStyle(d: string) {
  if (!d) return { color: "var(--c-text-4)", bg: "var(--c-elevated)", border: "var(--c-border)" };
  const l = d.toLowerCase();
  if (l === "easy") return { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.28)" };
  if (l === "hard") return { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.28)" };
  return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.28)" };
}

export default function QBankRunner({
  questions,
  mode: initialMode = "tutor",
  subjectLabel = "Mixed Session",
  exam = "IFOM_CSE",
  backHref = "/qbank",
  sessionId,
}: {
  questions: Q[];
  mode?: Mode;
  subjectLabel?: string;
  exam?: string;
  backHref?: string;
  sessionId?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => Array(questions.length).fill(null));
  const [revealeds, setRevealeds] = useState<boolean[]>(() => Array(questions.length).fill(false));
  const [results, setResults] = useState<Result[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [toolBusy, setToolBusy] = useState<"highlight" | "bookmark" | "note" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  const picked = picks[i] ?? null;
  const revealed = revealeds[i] ?? false;

  const sessionIdRef = useRef<string | null>(sessionId || null);
  const resultsRef = useRef<Result[]>([]);
  const iRef = useRef(0);
  const secondsRef = useRef(0);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    iRef.current = i;
  }, [i]);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (sessionIdRef.current || !questions.length) return;
    let cancelled = false;
    fetch("/api/quiz/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: initialMode === "tutor" ? "Tutor" : initialMode === "exam" ? "Exam" : "Timed",
        exam_code: exam,
        subject_title: subjectLabel,
        question_count: questions.length,
        question_ids: questions.map((q) => q.id),
      }),
    })
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        if (cancelled) return;
        if (data?.session?.id) sessionIdRef.current = data.session.id;
      });
    return () => {
      cancelled = true;
    };
  }, [exam, initialMode, questions, subjectLabel]);

  useEffect(() => {
    function saveAsSuspended() {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const res = resultsRef.current;
      const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
      res.forEach((r) => {
        answersMap[r.id] = { chosen: r.chosen, correct: r.correct };
      });
      fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          status: res.length >= questions.length ? "complete" : "suspended",
          current_index: iRef.current,
          answers_json: answersMap,
          seconds_elapsed: secondsRef.current,
        }),
      }).catch(() => {});
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveAsSuspended();
    };
    window.addEventListener("pagehide", saveAsSuspended);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", saveAsSuspended);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [questions.length]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!isPaused && !revealed && i < questions.length) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused, revealed, i, questions.length]);

  const answered = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = answered - correctCount;
  const accuracy = answered ? Math.round((correctCount / answered) * 100) : 0;
  const navigatorItems = questions.map((item, idx) => {
    const revealedLocal = revealeds[idx];
    const pickLocal = picks[idx];
    const result = results.find((r) => r.id === item.id);
    return { item, idx, revealedLocal, pickLocal, result };
  });

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  async function patchSession(patch: Record<string, unknown>) {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // ignore
    }
  }

  if (!questions.length) {
    return (
      <div className="card mt-6 p-10 text-center" style={{ color: "var(--c-text-3)" }}>
        <Target className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="font-medium">No questions found for this selection.</p>
      </div>
    );
  }

  if (i >= questions.length) {
    return (
      <div className="min-h-[100dvh]" style={{ background: "var(--c-bg)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="overflow-hidden rounded-[30px] border" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-elevated)" }}>
            <div className="h-1.5 w-full bg-gradient-to-r from-brand via-cyan-400 to-violet-500" />
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)", border: "1px solid var(--c-brand-border)" }}>
                Session Complete
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>{subjectLabel}</div>
              <div className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>{correctCount} of {questions.length} correct</div>
              <div className="mt-3 text-5xl font-extrabold text-brand">{accuracy}%</div>
              <div className="mx-auto mt-6 max-w-lg">
                <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400 transition-all duration-700" style={{ width: `${accuracy}%` }} />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                <StatCard label="Answered" value={answered} color="var(--c-text-1)" />
                <StatCard label="Correct" value={correctCount} color="#22c55e" />
                <StatCard label="Incorrect" value={incorrectCount} color="#ef4444" />
                <StatCard label="Accuracy" value={`${accuracy}%`} color="#38bdf8" />
              </div>
              <Link href={backHref} className="btn-primary mt-6 w-full">Back to Q-Bank</Link>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {questions.map((q, idx) => {
              const result = results[idx];
              return (
                <div key={q.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium leading-relaxed" style={{ color: "var(--c-text-2)" }}>
                      <span style={{ color: "var(--c-text-4)" }} className="mr-1 font-normal">{idx + 1}.</span>
                      {excerpt(q.stem, 90)}
                    </div>
                    {result?.correct ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <CheckCircle2 className="h-3 w-3" /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <XCircle className="h-3 w-3" /> Wrong
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const rawQ = questions[i];
  const q = repairQuestion(rawQ);
  const imageHref = assetHref(q.image_path);
  const details = splitExplanation(q.explanation);
  const progressPct = ((i + 1) / questions.length) * 100;
  const topic = getTopic(q.tags);
  const diff = difficultyStyle(q.difficulty);
  const isCorrectAnswer = picked === q.answer_key;
  const wrongChoices = q.choices.filter((c) => c.key !== q.answer_key);

  async function submit() {
    if (!picked || revealed) return;
    const correct = picked === q.answer_key;
    const newResult = { id: q.id, chosen: picked, correct };
    setRevealeds((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    setResults((list) => {
      const existing = list.find((r) => r.id === q.id);
      const updated = existing ? list.map((r) => (r.id === q.id ? newResult : r)) : [...list, newResult];
      void (async () => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
        updated.forEach((r) => {
          answersMap[r.id] = { chosen: r.chosen, correct: r.correct };
        });
        const isLast = iRef.current + 1 >= questions.length;
        await patchSession({
          status: isLast ? "complete" : "active",
          current_index: iRef.current,
          answers_json: answersMap,
          seconds_elapsed: secondsRef.current,
          ...(isLast ? { score_pct: Math.round((updated.filter((r) => r.correct).length / questions.length) * 100) } : {}),
        });
      })();
      return updated;
    });
    const s = createClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (user) {
      await s.from("question_attempts").insert({
        user_id: user.id,
        question_id: q.id,
        chosen: picked,
        correct,
        time_ms: seconds * 1000,
      });
    }
  }

  async function saveLibraryEntry(
    entry_type: "highlight" | "bookmark" | "note",
    payload?: { body?: string | null; quote?: string | null; color?: string | null },
  ) {
    setToolBusy(entry_type);
    setToolStatus(null);
    try {
      const response = await fetch("/api/medical-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type,
          lesson_id: null,
          subject_slug: null,
          title: `${subjectLabel} · Q${i + 1}`,
          body: payload?.body ?? null,
          quote: payload?.quote ?? q.stem,
          color: payload?.color ?? (entry_type === "highlight" ? "#fde047" : entry_type === "bookmark" ? "#60a5fa" : "#34d399"),
          data: { question_id: q.id, subject_label: subjectLabel, exam, answer_key: q.answer_key, chosen: picked, tags: q.tags },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed");
      setToolStatus(entry_type === "highlight" ? "Highlighted." : entry_type === "bookmark" ? "Bookmarked." : "Note saved.");
      if (entry_type === "note") {
        setNoteText("");
        setNoteOpen(false);
      }
    } catch (error: unknown) {
      setToolStatus(error instanceof Error ? error.message : "Failed");
    } finally {
      setToolBusy(null);
    }
  }

  function next() {
    setI((x) => x + 1);
    setSeconds(0);
    setToolStatus(null);
    setNoteOpen(false);
    setNoteText("");
    setReportOpen(false);
    setImageOpen(false);
    setImageZoom(1);
  }

  function prev() {
    if (i <= 0) return;
    setI((x) => x - 1);
    setSeconds(0);
    setToolStatus(null);
    setNoteOpen(false);
    setNoteText("");
    setReportOpen(false);
    setImageOpen(false);
    setImageZoom(1);
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--c-bg)" }}>
      <div className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "var(--c-header-bg)", borderColor: "var(--c-border)" }}>
        <div className="px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Link href={backHref} className="grid h-10 w-10 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <button onClick={() => setNavigatorOpen((v) => !v)} className="hidden h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold lg:inline-flex" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-2)" }}>
              <FolderTree className="h-4 w-4" />
              {navigatorOpen ? "Hide" : "Show"} nav
            </button>
            <div className="min-w-[130px]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>QBank</div>
              <div className="text-base font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Question {i + 1} of {questions.length}</div>
            </div>
            <div className="hidden rounded-full px-3 py-1 text-xs font-semibold sm:block" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}>{subjectLabel}</div>
            <div className="hidden rounded-full px-3 py-1 text-xs font-semibold md:block" style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>{q.difficulty || "Mixed"}</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-2)" }}>
                <span style={{ color: "var(--c-text-4)" }}>⏱</span>
                <span className="tabular-nums">{formatTime(seconds)}</span>
                <button onClick={() => setIsPaused((v) => !v)} style={{ color: "var(--c-blue)" }}>
                  {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                </button>
              </div>
              <div className="hidden rounded-2xl border p-1 text-sm font-semibold md:flex" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
                {(["tutor", "exam"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className="rounded-xl px-4 py-1.5 capitalize transition" style={mode === m ? { background: "var(--c-blue)", color: "#fff" } : { color: "var(--c-text-3)" }}>
                    {m}
                  </button>
                ))}
              </div>
              <button onClick={() => void saveLibraryEntry("bookmark")} disabled={toolBusy === "bookmark"} className="grid h-10 w-10 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: toolBusy === "bookmark" ? "var(--c-blue)" : "var(--c-text-3)" }} title="Bookmark">
                <BookmarkPlus className="h-4 w-4" />
              </button>
              <button onClick={() => setReportOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: reportOpen ? "#ef4444" : "var(--c-text-3)" }} title="Report issue">
                <Flag className="h-4 w-4" />
              </button>
              <Link href="/notifications" className="hidden h-10 w-10 place-items-center rounded-2xl border transition md:grid" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}>
                <Bell className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {reportOpen && (
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
          <div className="rounded-[22px] border p-4" style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}>
            <div className="mb-2 flex items-center gap-2">
              <Flag className="h-4 w-4" style={{ color: "#ef4444" }} />
              <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>Report an Issue</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Wrong answer key", "Unclear question", "Incorrect explanation", "Typo / formatting"].map((reason) => (
                <button key={reason} onClick={() => { setToolStatus(`Reported: ${reason}`); setReportOpen(false); }} className="rounded-xl border px-3 py-1.5 text-xs font-medium transition" style={{ borderColor: "rgba(239,68,68,0.25)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 px-4 py-4 md:px-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(300px,360px)]">
        <aside className={`${navigatorOpen ? "block" : "hidden sm:block"} ${navigatorOpen ? "lg:block" : "lg:hidden"}`}>
          <div className="rounded-[26px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Navigation</div>
                <div className="mt-1 text-base font-bold" style={{ color: "var(--c-text-1)" }}>Question map</div>
              </div>
              <div className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "var(--c-elevated)", color: "var(--c-text-4)", border: "1px solid var(--c-border)" }}>{answered}/{questions.length} answered</div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-4">
              {navigatorItems.map(({ item, idx, revealedLocal, pickLocal, result }) => {
                const active = idx === i;
                const hasPick = Boolean(pickLocal);
                const isCorrect = result?.correct;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setI(idx);
                      setSeconds(0);
                      setNoteOpen(false);
                      setReportOpen(false);
                    }}
                    className="flex h-11 items-center justify-center rounded-2xl border text-xs font-semibold transition"
                    style={active
                      ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.12)", color: "var(--c-blue)" }
                      : revealedLocal && isCorrect
                        ? { borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.08)", color: "#22c55e" }
                        : revealedLocal && !isCorrect
                          ? { borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }
                          : hasPick
                            ? { borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.08)", color: "#d97706" }
                            : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 text-xs" style={{ color: "var(--c-text-4)" }}>
              <LegendDot color="#2563eb" label="Current" />
              <LegendDot color="#22c55e" label="Correct" />
              <LegendDot color="#ef4444" label="Incorrect" />
              <LegendDot color="#d97706" label="Selected" />
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="rounded-[28px] border p-4 sm:p-5 md:p-6" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ background: "var(--c-blue-bg)", color: "var(--c-blue)", border: "1px solid var(--c-blue-border)" }}>{subjectLabel}</span>
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}>{topic}</span>
              {q.difficulty ? <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>{q.difficulty}</span> : null}
            </div>

            <div className="mt-5 text-[17px] font-medium leading-[1.7] sm:text-[18px]" style={{ color: "var(--c-text-1)" }}>
              {q.stem}
            </div>

            {imageHref ? (
              <button onClick={() => setImageOpen(true)} className="mt-5 block w-full overflow-hidden rounded-[24px] border text-left transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
                <img src={imageHref} alt={q.image_caption || "Question image"} className="max-h-[420px] w-full object-contain" />
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: "var(--c-border)", color: "var(--c-text-3)" }}>
                  <span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {q.image_caption || "Clinical figure"}</span>
                  <span className="inline-flex items-center gap-2 font-semibold" style={{ color: "var(--c-blue)" }}><Expand className="h-4 w-4" /> Open viewer</span>
                </div>
              </button>
            ) : null}

            <div className="mt-6 space-y-3">
              {q.choices.map((choice) => {
                const isCorrect = choice.key === q.answer_key;
                const isPicked = choice.key === picked;
                let bg = "var(--c-card)";
                let border = "var(--c-border)";
                let textColor = "var(--c-text-1)";
                if (revealed) {
                  if (isCorrect) {
                    bg = "rgba(34,197,94,0.10)";
                    border = "rgba(34,197,94,0.45)";
                    textColor = "#166534";
                  } else if (isPicked) {
                    bg = "rgba(239,68,68,0.10)";
                    border = "rgba(239,68,68,0.45)";
                    textColor = "#b91c1c";
                  }
                } else if (isPicked) {
                  bg = "rgba(37,99,235,0.08)";
                  border = "var(--c-blue)";
                }
                return (
                  <button
                    key={choice.key}
                    className="w-full rounded-[22px] border p-4 text-left text-sm font-medium leading-7 transition sm:p-5"
                    style={{ background: bg, borderColor: border, color: textColor }}
                    disabled={revealed}
                    onClick={() =>
                      setPicks((prev) => {
                        const next = [...prev];
                        next[i] = choice.key;
                        return next;
                      })
                    }
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: isPicked || (revealed && isCorrect) ? border : "var(--c-elevated)", color: isPicked || (revealed && isCorrect) ? "#fff" : "var(--c-text-3)" }}>{choice.key}</span>
                      <span className="flex-1">{choice.text}</span>
                      {revealed && isCorrect ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /> : null}
                      {revealed && isPicked && !isCorrect ? <XCircle className="mt-1 h-4 w-4 shrink-0" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {revealed && mode === "tutor" ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border p-4" style={{ background: isCorrectAnswer ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)", borderColor: isCorrectAnswer ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)" }}>
                  <div className="flex items-center gap-2">
                    {isCorrectAnswer ? <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} /> : <XCircle className="h-5 w-5" style={{ color: "#ef4444" }} />}
                    <span className="text-base font-bold" style={{ color: isCorrectAnswer ? "#22c55e" : "#ef4444" }}>{isCorrectAnswer ? "Correct" : "Incorrect"}</span>
                    <span className="ml-auto rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(34,197,94,0.12)", color: "#15803d" }}>Correct answer: {q.answer_key}</span>
                  </div>
                  <div className="mt-2 text-sm" style={{ color: "var(--c-text-3)" }}>
                    {isCorrectAnswer ? `You answered ${picked}.` : <>You answered <strong>{picked}</strong>. Correct answer: <strong>{q.answer_key}</strong>.</>}
                  </div>
                </div>

                {details.explanation ? (
                  <div className="rounded-[24px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
                    <div className="mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" style={{ color: "var(--c-blue)" }} />
                      <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--c-blue)" }}>Explanation</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: "var(--c-text-2)" }}>{details.explanation}</div>
                  </div>
                ) : null}

                {details.educationalObjective ? (
                  <div className="rounded-[24px] border p-4" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.20)" }}>
                    <div className="mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" style={{ color: "#10b981" }} />
                      <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#10b981" }}>High-Yield takeaway</span>
                    </div>
                    <div className="text-sm leading-7" style={{ color: "var(--c-text-2)" }}>{details.educationalObjective}</div>
                  </div>
                ) : null}

                {wrongChoices.length > 0 ? (
                  <details className="rounded-[24px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
                    <summary className="cursor-pointer list-none text-sm font-semibold" style={{ color: "var(--c-text-2)" }}>Review the other answer choices</summary>
                    <div className="mt-3 space-y-2">
                      {wrongChoices.map((choice) => (
                        <div key={choice.key} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)" }}>{choice.key}</span>
                          <span style={{ color: "var(--c-text-3)" }}>{choice.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {q.tags.filter(Boolean).length > 0 ? (
                  <div className="rounded-[24px] border p-4" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.20)" }}>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#d97706" }}>High-Yield tags</div>
                    <div className="flex flex-wrap gap-2">
                      {q.tags.filter(Boolean).map((tag) => (
                        <span key={tag} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(245,158,11,0.10)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {revealed && rawQ.video_url ? (
              <div className="mt-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--c-border)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" style={{ color: "#ef4444" }}>
                    <path d="M23.498 6.186a2.99 2.99 0 0 0-2.11-2.11C19.527 3.5 12 3.5 12 3.5s-7.527 0-9.388.576a2.99 2.99 0 0 0-2.11 2.11C0 8.047 0 12 0 12s0 3.953.502 5.814a2.99 2.99 0 0 0 2.11 2.11C4.473 20.5 12 20.5 12 20.5s7.527 0 9.388-.576a2.99 2.99 0 0 0 2.11-2.11C24 15.953 24 12 24 12s0-3.953-.502-5.814zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--c-text-3)" }}>Video Explanation</span>
                </div>
                {getYouTubeId(rawQ.video_url) ? (
                  <div className="relative" style={{ paddingBottom: "56.25%" }}>
                    <iframe src={`https://www.youtube.com/embed/${getYouTubeId(rawQ.video_url)}?rel=0&modestbranding=1`} title="Video Explanation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
                  </div>
                ) : (
                  <div className="relative" style={{ paddingBottom: "56.25%" }}>
                    <iframe src={rawQ.video_url} title="Video Explanation" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
                  </div>
                )}
              </div>
            ) : null}

            {noteOpen ? (
              <div className="mt-4 rounded-[24px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
                <textarea className="input w-full resize-none rounded-2xl text-sm" rows={3} placeholder="Add a note for this question…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary text-sm" disabled={!noteText.trim()} onClick={() => void saveLibraryEntry("note", { body: noteText })}>Save note</button>
                  <button className="btn-ghost text-sm" onClick={() => { setNoteOpen(false); setNoteText(""); }}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <aside className="min-w-0">
          <div className="space-y-4">
            <div className="rounded-[26px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Context panel</div>
                  <div className="mt-1 text-base font-bold" style={{ color: "var(--c-text-1)" }}>Figure & tools</div>
                </div>
                {imageHref ? <button onClick={() => setImageOpen(true)} className="rounded-xl border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-blue)" }}>Open viewer</button> : null}
              </div>

              {imageHref ? (
                <button onClick={() => setImageOpen(true)} className="mt-4 block w-full overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
                  <img src={imageHref} alt={q.image_caption || "Question image"} className="max-h-72 w-full object-contain" />
                </button>
              ) : (
                <div className="mt-4 rounded-[22px] border p-5 text-center text-sm" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-4)" }}>
                  This question has no linked image.
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-2xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
                  <FlaskConical className="mx-auto mb-1 h-4 w-4" />
                  Labs
                </button>
                <button className="rounded-2xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
                  <Calculator className="mx-auto mb-1 h-4 w-4" />
                  Calculator
                </button>
              </div>
            </div>

            <div className="rounded-[26px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Session status</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Done" value={answered} color="var(--c-text-1)" />
                <MiniMetric label="Correct" value={correctCount} color="#22c55e" />
                <MiniMetric label="Wrong" value={incorrectCount} color="#ef4444" />
              </div>
              <div className="mt-3 rounded-2xl border p-3 text-sm" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}>
                Accuracy so far: <strong style={{ color: "var(--c-text-1)" }}>{accuracy}%</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {imageOpen && imageHref ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] border" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6" style={{ borderColor: "var(--c-border)" }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>Figure 1 of 1</div>
                <div className="text-xs" style={{ color: "var(--c-text-4)" }}>{q.image_caption || subjectLabel}</div>
              </div>
              <button onClick={() => setImageOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              <div className="flex h-full items-center justify-center rounded-[24px]" style={{ background: "var(--c-elevated)" }}>
                <img src={imageHref} alt={q.image_caption || "Question image"} className="max-h-full max-w-full object-contain transition-transform duration-150" style={{ transform: `scale(${imageZoom})` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 md:px-6" style={{ borderColor: "var(--c-border)" }}>
              <div className="flex items-center gap-2">
                <button onClick={() => setImageZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}><Minus className="h-4 w-4" /></button>
                <div className="min-w-[72px] text-center text-sm font-semibold" style={{ color: "var(--c-text-2)" }}>{Math.round(imageZoom * 100)}%</div>
                <button onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}><Plus className="h-4 w-4" /></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void saveLibraryEntry("note", { body: `Image note: ${q.image_caption || `Question ${i + 1}`}` })} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>Add to notes</button>
                <button onClick={() => void saveLibraryEntry("bookmark")} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-blue)" }}>Bookmark</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-6 pt-3 md:px-6 md:pb-4" style={{ background: "var(--c-header-bg)", borderColor: "var(--c-border)" }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          {toolStatus ? <div className="text-center text-xs font-medium" style={{ color: "var(--c-blue)" }}>{toolStatus}</div> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="shrink-0 flex gap-1.5">
              <button onClick={() => void saveLibraryEntry("highlight")} disabled={toolBusy === "highlight"} className="grid h-11 w-11 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: toolBusy === "highlight" ? "var(--c-blue)" : "var(--c-text-3)" }} title="Highlight">
                <Highlighter className="h-4 w-4" />
              </button>
              <button onClick={() => setNoteOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: noteOpen ? "var(--c-blue)" : "var(--c-text-3)" }} title="Add note">
                <PencilLine className="h-4 w-4" />
              </button>
            </div>
            <button onClick={prev} disabled={i <= 0} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-40" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            <div className="flex-1">
              {!revealed ? (
                <button className="btn-primary h-12 w-full rounded-2xl text-base" disabled={!picked} onClick={() => void submit()}>
                  Reveal Answer
                </button>
              ) : (
                <button className="btn-primary h-12 w-full rounded-2xl text-base" onClick={next}>
                  Next Question <ChevronRight className="ml-1 h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--c-border)", background: "var(--c-elevated)" }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--c-text-4)" }}>{label}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--c-text-4)" }}>{label}</div>
    </div>
  );
}
