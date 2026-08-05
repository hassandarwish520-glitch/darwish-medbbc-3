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
  Stethoscope,
  Target,
  Flag,
  Lightbulb,
  BookOpen,
  AlertTriangle,
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
    return {
      explanation: "No explanation provided for this question yet.",
      educationalObjective: "—",
    };
  }
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "No explanation provided for this question yet.",
    educationalObjective: parts[1]?.trim() || "—",
  };
}

function getTopic(tags: string[]) {
  return tags.filter(Boolean).slice(1, 3).join(" · ") || "Clinical reasoning";
}

function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([A-Za-z0-9_-]{11})/
  );
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
}: {
  questions: Q[];
  mode?: Mode;
  subjectLabel?: string;
  exam?: string;
  backHref?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [i, setI] = useState(0);
  // Per-question state arrays so Previous works correctly
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

  const picked = picks[i] ?? null;
  const revealed = revealeds[i] ?? false;

  const sessionIdRef = useRef<string | null>(null);
  const resultsRef = useRef<Result[]>([]);
  const iRef = useRef(0);
  const secondsRef = useRef(0);

  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  useEffect(() => {
    if (!questions.length) return;
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function saveAsSuspended() {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const res = resultsRef.current;
      if (!res.length) return;
      const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
      res.forEach((r) => { answersMap[r.id] = { chosen: r.chosen, correct: r.correct }; });
      fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          status: "suspended",
          current_index: iRef.current,
          answers_json: answersMap,
          seconds_elapsed: secondsRef.current,
        }),
      }).catch(() => {});
    }
    const onVisibility = () => { if (document.visibilityState === "hidden") saveAsSuspended(); };
    window.addEventListener("pagehide", saveAsSuspended);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", saveAsSuspended);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!isPaused && !revealed && i < questions.length) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isPaused, revealed, i, questions.length]);

  const answered = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = answered - correctCount;
  const accuracy = answered ? Math.round((correctCount / answered) * 100) : 0;

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
    } catch { /* ignore */ }
  }

  if (!questions.length) {
    return (
      <div className="card mt-6 p-10 text-center" style={{ color: "var(--c-text-3)" }}>
        <Target className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="font-medium">No questions found for this selection.</p>
      </div>
    );
  }

  /* ── Session complete ── */
  if (i >= questions.length) {
    return (
      <div className="min-h-[100dvh] pb-24" style={{ background: "var(--c-bg)" }}>
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
          <div className="card overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-brand via-cyan-400 to-violet-500" />
            <div className="p-8 text-center">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)", border: "1px solid var(--c-brand-border)" }}
              >
                Session Complete
              </div>
              <div className="mt-4 text-3xl font-bold" style={{ color: "var(--c-text-1)" }}>{subjectLabel}</div>
              <div className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>
                {correctCount} of {questions.length} correct
              </div>
              <div className="mt-3 text-5xl font-extrabold text-brand">{accuracy}%</div>
              <div className="mx-auto mt-6 max-w-lg">
                <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400 transition-all duration-700"
                    style={{ width: `${accuracy}%` }}
                  />
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

  async function submit() {
    if (!picked || revealed) return;
    const correct = picked === q.answer_key;
    const newResult = { id: q.id, chosen: picked, correct };
    // Mark as revealed
    setRevealeds((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    setResults((list) => {
      // Avoid duplicates
      const existing = list.find((r) => r.id === q.id);
      const updated = existing ? list.map((r) => r.id === q.id ? newResult : r) : [...list, newResult];
      void (async () => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
        updated.forEach((r) => { answersMap[r.id] = { chosen: r.chosen, correct: r.correct }; });
        const isLast = (iRef.current + 1) >= questions.length;
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
    const { data: { user } } = await s.auth.getUser();
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
    payload?: { body?: string | null; quote?: string | null; color?: string | null }
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
      if (entry_type === "note") { setNoteText(""); setNoteOpen(false); }
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
  }

  function prev() {
    if (i <= 0) return;
    setI((x) => x - 1);
    setSeconds(0);
    setToolStatus(null);
    setNoteOpen(false);
    setNoteText("");
    setReportOpen(false);
  }

  const isCorrectAnswer = picked === q.answer_key;
  const wrongChoices = q.choices.filter((c) => c.key !== q.answer_key);

  return (
    <div className="min-h-[100dvh] pb-32 md:pb-24" style={{ background: "var(--c-bg)" }}>

      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ background: "var(--c-header-bg)", borderBottom: "1px solid var(--c-border)" }}
      >
        {/* Mobile brand bar */}
        <div className="border-b px-4 py-3 md:hidden" style={{ borderColor: "var(--c-border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>MEDICAL Q-BANK</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand">Study smarter</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void saveLibraryEntry("bookmark")}
                disabled={toolBusy === "bookmark"}
                className="grid h-9 w-9 place-items-center rounded-xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: toolBusy === "bookmark" ? "var(--c-brand)" : "var(--c-text-3)" }}
                title="Bookmark"
              >
                <BookmarkPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setReportOpen((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: reportOpen ? "#ef4444" : "var(--c-text-3)" }}
                title="Report issue"
              >
                <Flag className="h-4 w-4" />
              </button>
              <Link href="/notifications" className="grid h-10 w-10 place-items-center rounded-2xl border transition" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}>
                <Bell className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Controls bar */}
        <div className="px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
            {/* Back */}
            <Link
              href={backHref}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border transition"
              style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-3)" }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            {/* Q counter */}
            <div className="tabular-nums text-base font-bold sm:text-lg" style={{ color: "var(--c-text-1)", minWidth: 72, textAlign: "center" }}>
              Q{i + 1}<span style={{ color: "var(--c-text-4)", fontWeight: 400 }}> / {questions.length}</span>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: "var(--c-text-2)" }}>
              <span style={{ color: "var(--c-text-4)" }}>⏱</span>
              <span className="tabular-nums">{formatTime(seconds)}</span>
              <button onClick={() => setIsPaused((v) => !v)} className="transition" style={{ color: "var(--c-brand)" }}>
                {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
              </button>
            </div>

            {/* Mode toggle */}
            <div className="ml-auto flex w-full justify-end rounded-2xl border p-1 text-sm font-semibold md:w-auto" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
              {(["tutor", "exam"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="rounded-xl px-4 py-1.5 capitalize transition"
                  style={mode === m ? { background: "var(--c-brand)", color: "#fff" } : { color: "var(--c-text-3)" }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Desktop bookmark/report */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => void saveLibraryEntry("bookmark")}
                disabled={toolBusy === "bookmark"}
                className="grid h-10 w-10 place-items-center rounded-2xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: toolBusy === "bookmark" ? "var(--c-brand)" : "var(--c-text-3)" }}
                title="Bookmark"
              >
                <BookmarkPlus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setReportOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-2xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-card)", color: reportOpen ? "#ef4444" : "var(--c-text-3)" }}
                title="Report issue"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Report panel */}
      {reportOpen && (
        <div className="mx-auto max-w-3xl px-4 pt-4 md:px-6">
          <div className="rounded-[22px] border p-4" style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}>
            <div className="mb-2 flex items-center gap-2">
              <Flag className="h-4 w-4" style={{ color: "#ef4444" }} />
              <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>Report an Issue</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Wrong answer key", "Unclear question", "Incorrect explanation", "Typo / formatting"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => { setToolStatus(`Reported: ${reason}`); setReportOpen(false); }}
                  className="rounded-xl border px-3 py-1.5 text-xs font-medium transition hover:border-red-400"
                  style={{ borderColor: "rgba(239,68,68,0.25)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Question body ── */}
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-6 md:px-6">

        {/* Subject / topic chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)", border: "1px solid var(--c-brand-border)" }}
          >
            {subjectLabel}
          </span>
          {topic && (
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)", border: "1px solid var(--c-border)" }}>
              {topic}
            </span>
          )}
          {q.difficulty && (
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
              {q.difficulty}
            </span>
          )}
        </div>

        {/* Stem card */}
        <div className="card rounded-[24px] p-5 text-base font-medium leading-8 md:text-lg" style={{ color: "var(--c-text-1)" }}>
          {imageHref && (
            <img
              src={imageHref}
              alt={q.image_caption || "Question image"}
              className="mb-4 max-h-72 w-full rounded-2xl object-contain"
              style={{ background: "var(--c-elevated)" }}
            />
          )}
          {q.stem}
        </div>

        {/* Choices */}
        <div className="mt-4 space-y-3">
          {q.choices.map((choice) => {
            const isCorrect = choice.key === q.answer_key;
            const isPicked = choice.key === picked;
            let bg = "var(--c-card)";
            let border = "var(--c-border)";
            let textColor = "var(--c-text-1)";
            if (revealed) {
              if (isCorrect) { bg = "rgba(34,197,94,0.10)"; border = "rgba(34,197,94,0.45)"; textColor = "#22c55e"; }
              else if (isPicked) { bg = "rgba(239,68,68,0.10)"; border = "rgba(239,68,68,0.45)"; textColor = "#ef4444"; }
            } else if (isPicked) {
              bg = "rgba(16,185,129,0.10)"; border = "#10b981";
            }
            return (
              <button
                key={choice.key}
                className="w-full rounded-[20px] border p-4 text-left text-sm font-medium leading-7 transition"
                style={{ background: bg, borderColor: border, color: textColor }}
                disabled={revealed}
                onClick={() => setPicks((prev) => { const next = [...prev]; next[i] = choice.key; return next; })}
              >
                <span
                  className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isPicked || (revealed && isCorrect) ? border : "var(--c-elevated)",
                    color: isPicked || (revealed && isCorrect) ? "#fff" : "var(--c-text-3)",
                  }}
                >
                  {choice.key}
                </span>
                {choice.text}
                {revealed && isCorrect && <CheckCircle2 className="ml-2 inline h-4 w-4" />}
                {revealed && isPicked && !isCorrect && <XCircle className="ml-2 inline h-4 w-4" />}
              </button>
            );
          })}
        </div>

        {/* ── ANSWER PAGE (Tutor mode, revealed) ── */}
        {revealed && mode === "tutor" && (
          <div className="mt-5 space-y-3">

            {/* Correct Answer */}
            <div
              className="rounded-[22px] border p-4"
              style={{
                background: isCorrectAnswer ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)",
                borderColor: isCorrectAnswer ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {isCorrectAnswer
                  ? <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} />
                  : <XCircle className="h-5 w-5" style={{ color: "#ef4444" }} />
                }
                <span className="text-base font-bold" style={{ color: isCorrectAnswer ? "#22c55e" : "#ef4444" }}>
                  {isCorrectAnswer ? "Correct!" : "Incorrect"}
                </span>
                <span className="ml-auto text-sm font-semibold px-3 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                  Answer: {q.answer_key}
                </span>
              </div>
              {!isCorrectAnswer && (
                <div className="text-sm" style={{ color: "var(--c-text-3)" }}>
                  You chose <strong style={{ color: "#ef4444" }}>{picked}</strong> · Correct answer is <strong style={{ color: "#22c55e" }}>{q.answer_key}</strong>
                </div>
              )}
            </div>

            {/* Explanation */}
            {details.explanation && (
              <div className="rounded-[22px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--c-brand)" }}>Explanation</span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: "var(--c-text-2)" }}>
                  {details.explanation}
                </div>
              </div>
            )}

            {/* Educational Objective / Learning Point */}
            {details.educationalObjective && details.educationalObjective !== "—" && (
              <div className="rounded-[22px] border p-4" style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.20)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" style={{ color: "#10b981" }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#10b981" }}>Learning Point</span>
                </div>
                <div className="text-sm leading-7" style={{ color: "var(--c-text-2)" }}>
                  {details.educationalObjective}
                </div>
              </div>
            )}

            {/* Why others are wrong */}
            {wrongChoices.length > 0 && (
              <div className="rounded-[22px] border p-4" style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.15)" }}>
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" style={{ color: "#ef4444" }} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#ef4444" }}>Why Others Are Wrong</span>
                </div>
                <div className="space-y-2">
                  {wrongChoices.map((choice) => (
                    <div key={choice.key} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}
                      >
                        {choice.key}
                      </span>
                      <span style={{ color: "var(--c-text-3)" }}>{choice.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High Yield Box */}
            <div className="rounded-[22px] border p-4" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.20)" }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#f59e0b" }}>⭐ High Yield</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {q.tags.filter(Boolean).map((tag) => (
                  <span key={tag} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(245,158,11,0.10)", color: "#d97706", border: "1px solid rgba(245,158,11,0.25)" }}>
                    {tag}
                  </span>
                ))}
                {q.tags.length === 0 && <span className="text-sm" style={{ color: "var(--c-text-4)" }}>Review this concept carefully for the exam.</span>}
              </div>
            </div>
          </div>
        )}

        {/* Video explanation */}
        {revealed && rawQ.video_url && (
          <div className="mt-4 rounded-[24px] border overflow-hidden" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)" }}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--c-border)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" style={{ color: "#ef4444" }}>
                <path d="M23.498 6.186a2.99 2.99 0 0 0-2.11-2.11C19.527 3.5 12 3.5 12 3.5s-7.527 0-9.388.576a2.99 2.99 0 0 0-2.11 2.11C0 8.047 0 12 0 12s0 3.953.502 5.814a2.99 2.99 0 0 0 2.11 2.11C4.473 20.5 12 20.5 12 20.5s7.527 0 9.388-.576a2.99 2.99 0 0 0 2.11-2.11C24 15.953 24 12 24 12s0-3.953-.502-5.814zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--c-text-3)" }}>Video Explanation</span>
            </div>
            {getYouTubeId(rawQ.video_url) ? (
              <div className="relative" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(rawQ.video_url)}?rel=0&modestbranding=1`}
                  title="Video Explanation"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="relative" style={{ paddingBottom: "56.25%" }}>
                <iframe src={rawQ.video_url} title="Video Explanation" allowFullScreen className="absolute inset-0 h-full w-full border-0" />
              </div>
            )}
          </div>
        )}

        {/* Note drawer */}
        {noteOpen && (
          <div className="mt-4 rounded-[24px] border p-4" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
            <textarea
              className="input w-full resize-none rounded-2xl text-sm"
              rows={3}
              placeholder="Add a note for this question…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <button className="btn-primary text-sm" disabled={!noteText.trim()} onClick={() => void saveLibraryEntry("note", { body: noteText })}>
                Save note
              </button>
              <button className="btn-ghost text-sm" onClick={() => { setNoteOpen(false); setNoteText(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-6 pt-3 md:px-6 md:pb-4"
        style={{ background: "var(--c-header-bg)", borderColor: "var(--c-border)" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {/* Tool status */}
          {toolStatus && (
            <div className="text-center text-xs font-medium" style={{ color: "var(--c-brand)" }}>{toolStatus}</div>
          )}

          {/* Main action row */}
          <div className="flex items-center gap-2">
            {/* Tool buttons */}
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => void saveLibraryEntry("highlight")}
                disabled={toolBusy === "highlight"}
                className="grid h-11 w-11 place-items-center rounded-2xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: toolBusy === "highlight" ? "var(--c-brand)" : "var(--c-text-3)" }}
                title="Highlight"
              >
                <Highlighter className="h-4 w-4" />
              </button>
              <button
                onClick={() => setNoteOpen((v) => !v)}
                className="grid h-11 w-11 place-items-center rounded-2xl border transition"
                style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: noteOpen ? "var(--c-brand)" : "var(--c-text-3)" }}
                title="Add note"
              >
                <PencilLine className="h-4 w-4" />
              </button>
            </div>

            {/* Previous */}
            <button
              onClick={prev}
              disabled={i <= 0}
              className="flex h-12 items-center gap-1.5 rounded-2xl border px-3 text-sm font-semibold transition disabled:opacity-40"
              style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Main CTA */}
            <div className="flex-1">
              {!revealed ? (
                <button
                  className="btn-primary h-12 w-full rounded-2xl text-base"
                  disabled={!picked}
                  onClick={() => void submit()}
                >
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
