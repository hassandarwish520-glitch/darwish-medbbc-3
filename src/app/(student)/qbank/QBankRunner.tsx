"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { repairQuestion } from "@/lib/question-normalizer";
import {
  ArrowLeft,
  Bell,
  BookmarkPlus,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Flag,
  FlaskConical,
  FolderTree,
  Highlighter,
  ImageIcon,
  Lightbulb,
  List,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Pause,
  PencilLine,
  Play,
  Plus,
  Target,
  X,
  XCircle,
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

type ContextTab = "figure" | "labs" | "calculator";

type LabItem = {
  test: string;
  value: string;
  ref: string;
  tone?: "normal" | "abnormal";
};

const LAB_REFERENCE: Record<string, LabItem[]> = {
  CBC: [
    { test: "WBC", value: "6.8 ×10³/µL", ref: "4.0 – 10.0" },
    { test: "RBC", value: "4.51 ×10⁶/µL", ref: "3.8 – 5.2" },
    { test: "Hemoglobin", value: "13.2 g/dL", ref: "12.0 – 15.5" },
    { test: "Hematocrit", value: "39.8 %", ref: "36 – 46" },
    { test: "MCV", value: "88 fL", ref: "80 – 100" },
    { test: "Platelets", value: "245 ×10³/µL", ref: "150 – 400" },
  ],
  BMP: [
    { test: "Na⁺", value: "138 mEq/L", ref: "135 – 145" },
    { test: "K⁺", value: "4.2 mEq/L", ref: "3.5 – 5.0" },
    { test: "Cl⁻", value: "102 mEq/L", ref: "98 – 106" },
    { test: "HCO₃⁻", value: "24 mEq/L", ref: "22 – 28" },
    { test: "BUN", value: "16 mg/dL", ref: "7 – 20" },
    { test: "Creatinine", value: "0.9 mg/dL", ref: "0.6 – 1.3" },
  ],
  LFTs: [
    { test: "AST", value: "24 U/L", ref: "10 – 40" },
    { test: "ALT", value: "28 U/L", ref: "7 – 56" },
    { test: "ALP", value: "88 U/L", ref: "44 – 147" },
    { test: "Total bilirubin", value: "0.8 mg/dL", ref: "0.2 – 1.2" },
    { test: "Albumin", value: "4.1 g/dL", ref: "3.5 – 5.0" },
  ],
  Coagulation: [
    { test: "PT", value: "12.1 s", ref: "11 – 13.5" },
    { test: "INR", value: "1.0", ref: "0.8 – 1.1" },
    { test: "aPTT", value: "31 s", ref: "25 – 35" },
    { test: "Fibrinogen", value: "310 mg/dL", ref: "200 – 400" },
  ],
  ABG: [
    { test: "pH", value: "7.40", ref: "7.35 – 7.45" },
    { test: "PaCO₂", value: "40 mmHg", ref: "35 – 45" },
    { test: "HCO₃⁻", value: "24 mEq/L", ref: "22 – 26" },
    { test: "PaO₂", value: "94 mmHg", ref: "80 – 100" },
  ],
  Endocrine: [
    { test: "TSH", value: "2.1 µIU/mL", ref: "0.4 – 4.5" },
    { test: "Free T4", value: "1.1 ng/dL", ref: "0.8 – 1.8" },
    { test: "Morning cortisol", value: "14 µg/dL", ref: "5 – 25" },
  ],
  Urinalysis: [
    { test: "Specific gravity", value: "1.018", ref: "1.005 – 1.030" },
    { test: "Protein", value: "Negative", ref: "Negative" },
    { test: "Glucose", value: "Negative", ref: "Negative" },
    { test: "RBC / HPF", value: "0 – 2", ref: "0 – 2" },
  ],
  CSF: [
    { test: "Opening pressure", value: "15 cm H₂O", ref: "10 – 20" },
    { test: "Protein", value: "34 mg/dL", ref: "15 – 45" },
    { test: "Glucose", value: "64 mg/dL", ref: "50 – 80" },
    { test: "WBC", value: "2 /µL", ref: "0 – 5" },
  ],
};

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)\/?/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function splitExplanation(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { explanation: "", educationalObjective: "" };
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "",
    educationalObjective: parts[1]?.trim() || "",
  };
}

function getTopic(tags: string[]) {
  return tags.filter(Boolean).slice(1, 3).join(" · ") || "Clinical reasoning";
}

function excerpt(value: string, max = 90) {
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

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  const [questionMapOpen, setQuestionMapOpen] = useState(true);
  const [contextVisible, setContextVisible] = useState(true);
  const [contextTab, setContextTab] = useState<ContextTab>("labs");
  const [labCategory, setLabCategory] = useState<string>("CBC");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calcNa, setCalcNa] = useState("140");
  const [calcCl, setCalcCl] = useState("102");
  const [calcHco3, setCalcHco3] = useState("24");

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
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (focusMode) {
      setQuestionMapOpen(false);
      setContextVisible(false);
    }
  }, [focusMode]);

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
      const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
      resultsRef.current.forEach((r) => {
        answersMap[r.id] = { chosen: r.chosen, correct: r.correct };
      });
      fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          status: resultsRef.current.length >= questions.length ? "complete" : "suspended",
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
  }, [i, isPaused, questions.length, revealed]);

  const answered = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = answered - correctCount;
  const accuracy = answered ? Math.round((correctCount / answered) * 100) : 0;
  const navigatorItems = questions.map((item, idx) => {
    const result = results.find((r) => r.id === item.id);
    return { item, idx, result, picked: picks[idx], revealed: revealeds[idx] };
  });

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
  }

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
                <Metric label="Answered" value={answered} color="var(--c-text-1)" />
                <Metric label="Correct" value={correctCount} color="#22c55e" />
                <Metric label="Incorrect" value={incorrectCount} color="#ef4444" />
                <Metric label="Accuracy" value={`${accuracy}%`} color="#38bdf8" />
              </div>
              <Link href={backHref} className="btn-primary mt-6 w-full">Back to Q-Bank</Link>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {questions.map((question, idx) => {
              const result = results[idx];
              return (
                <div key={question.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium leading-relaxed" style={{ color: "var(--c-text-2)" }}>
                      <span className="mr-1 font-normal" style={{ color: "var(--c-text-4)" }}>{idx + 1}.</span>
                      {excerpt(question.stem)}
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
  const topic = getTopic(q.tags);
  const diff = difficultyStyle(q.difficulty);
  const details = splitExplanation(q.explanation);
  const progressPct = ((i + 1) / questions.length) * 100;
  const isCorrectAnswer = picked === q.answer_key;
  const wrongChoices = q.choices.filter((choice) => choice.key !== q.answer_key);
  const labItems = LAB_REFERENCE[labCategory] ?? [];
  const anionGap = Number(calcNa || 0) - (Number(calcCl || 0) + Number(calcHco3 || 0));

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

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("question_attempts").insert({
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
    <div className="min-h-[100dvh] pb-28" style={{ background: "radial-gradient(circle at top right, rgba(37,99,235,0.12), transparent 28%), var(--c-bg)" }}>
      <div className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "rgba(6,11,24,0.86)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="mx-auto flex w-full max-w-[1520px] items-start justify-between gap-4 px-4 py-4 md:px-6">
          <div className="min-w-0 flex items-start gap-3">
            <Link href={backHref} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-white">QBank</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: "#d1d9ea" }}>
                <span className="font-semibold">{subjectLabel}</span>
                <span style={{ color: "#5f6f8d" }}>•</span>
                <span>Question {i + 1} of {questions.length}</span>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "rgba(96,165,250,0.28)", background: "rgba(59,130,246,0.10)", color: "#93c5fd" }}>{(q.tags[0] || subjectLabel).toUpperCase()}</span>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: diff.border, background: diff.bg, color: diff.color }}>{q.difficulty || "Intermediate"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              <span className="tabular-nums">{formatTime(seconds)}</span>
              <button onClick={() => setIsPaused((v) => !v)}>{isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}</button>
            </div>
            <div className="flex rounded-2xl border p-1" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)" }}>
              {(["tutor", "exam"] as const).map((entry) => (
                <button key={entry} onClick={() => setMode(entry)} className="rounded-xl px-4 py-2 text-sm font-semibold capitalize transition" style={mode === entry ? { background: "#2563eb", color: "#fff" } : { color: "#aab6ce" }}>
                  {entry}
                </button>
              ))}
            </div>
            <button onClick={() => void saveLibraryEntry("bookmark")} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              <BookmarkPlus className="h-4 w-4" />
            </button>
            <button onClick={() => setReportOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: reportOpen ? "#f87171" : "#dbe6ff" }}>
              <Flag className="h-4 w-4" />
            </button>
            <button onClick={() => setFocusMode((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: focusMode ? "rgba(37,99,235,0.18)" : "rgba(12,18,34,0.92)", color: focusMode ? "#93c5fd" : "#dbe6ff" }}>
              <Target className="h-4 w-4" />
            </button>
            <button onClick={toggleFullscreen} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1520px] px-4 py-4 md:px-6">
        {reportOpen ? (
          <div className="mb-4 rounded-[22px] border p-4" style={{ background: "rgba(127,29,29,0.18)", borderColor: "rgba(248,113,113,0.28)" }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "#fecaca" }}>
              <Flag className="h-4 w-4" /> Report issue
            </div>
            <div className="flex flex-wrap gap-2">
              {["Wrong answer key", "Unclear stem", "Formatting issue", "Explanation issue"].map((reason) => (
                <button key={reason} onClick={() => { setToolStatus(`Reported: ${reason}`); setReportOpen(false); }} className="rounded-xl border px-3 py-2 text-xs font-medium" style={{ borderColor: "rgba(248,113,113,0.24)", background: "rgba(12,18,34,0.9)", color: "#fca5a5" }}>
                  {reason}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!focusMode ? (
          <section className="mb-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(12,18,34,0.96), rgba(8,13,26,0.96))", boxShadow: "0 18px 48px rgba(0,0,0,0.22)" }}>
            <button onClick={() => setQuestionMapOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dbe6ff" }}>
                  <List className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Question Map</div>
                  <div className="text-xs" style={{ color: "#92a2bf" }}>{answered}/{questions.length} answered</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "#92a2bf" }}>
                <span>{answered}/{questions.length} answered</span>
                <ChevronDown className={`h-4 w-4 transition ${questionMapOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </button>
            {questionMapOpen ? (
              <div className="border-t px-4 py-4 md:px-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "#aab6ce" }}>
                  <Legend color="#3b82f6" label="Current" />
                  <Legend color="#22c55e" label="Correct" />
                  <Legend color="#ef4444" label="Incorrect" />
                  <Legend color="#f59e0b" label="Selected" />
                  <Legend color="#94a3b8" label="Unanswered" />
                </div>
                <div className="mt-4 grid grid-cols-9 gap-2 sm:grid-cols-12 lg:grid-cols-18">
                  {navigatorItems.map(({ item, idx, result, picked: pickedLocal, revealed: revealedLocal }) => {
                    const active = idx === i;
                    const hasPick = Boolean(pickedLocal);
                    const isCorrect = result?.correct;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setI(idx); setSeconds(0); setToolStatus(null); setNoteOpen(false); }}
                        className="flex h-8 items-center justify-center rounded-xl border text-[11px] font-semibold transition"
                        style={active
                          ? { borderColor: "#3b82f6", background: "rgba(59,130,246,0.18)", color: "#93c5fd" }
                          : revealedLocal && isCorrect
                            ? { borderColor: "rgba(34,197,94,0.28)", background: "rgba(34,197,94,0.12)", color: "#4ade80" }
                            : revealedLocal && !isCorrect
                              ? { borderColor: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.12)", color: "#f87171" }
                              : hasPick
                                ? { borderColor: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.12)", color: "#fbbf24" }
                                : { borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", color: "#94a3b8" }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[26px] border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(12,18,34,0.97), rgba(8,13,26,0.97))", boxShadow: "0 18px 48px rgba(0,0,0,0.22)" }}>
          <div className="px-4 py-4 md:px-5 md:py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "rgba(96,165,250,0.24)", background: "rgba(59,130,246,0.10)", color: "#93c5fd" }}>{(q.tags[0] || subjectLabel).toUpperCase()}</span>
              <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#c9d3e7" }}>{topic}</span>
              {q.difficulty ? <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: diff.border, background: diff.bg, color: diff.color }}>{q.difficulty}</span> : null}
            </div>

            <div className="mt-5 max-w-[1040px] text-[25px] font-semibold leading-[1.55] tracking-[-0.02em] md:text-[33px]" style={{ color: "#f8fbff" }}>
              {q.stem}
            </div>

            <div className="mt-6 space-y-3">
              {q.choices.map((choice) => {
                const isCorrect = choice.key === q.answer_key;
                const isPicked = choice.key === picked;
                let bg = "rgba(255,255,255,0.02)";
                let border = "rgba(255,255,255,0.07)";
                let textColor = "#f3f7ff";
                let helperColor = "#8da0c0";
                if (revealed) {
                  if (isCorrect) {
                    bg = "rgba(34,197,94,0.10)";
                    border = "rgba(34,197,94,0.35)";
                    textColor = "#dcfce7";
                    helperColor = "#86efac";
                  } else if (isPicked) {
                    bg = "rgba(239,68,68,0.10)";
                    border = "rgba(239,68,68,0.35)";
                    textColor = "#fee2e2";
                    helperColor = "#fca5a5";
                  }
                } else if (isPicked) {
                  bg = "rgba(59,130,246,0.12)";
                  border = "rgba(59,130,246,0.35)";
                  helperColor = "#93c5fd";
                }
                return (
                  <button
                    key={choice.key}
                    disabled={revealed}
                    onClick={() => setPicks((prev) => { const next = [...prev]; next[i] = choice.key; return next; })}
                    className="w-full rounded-[20px] border p-4 text-left transition md:p-5"
                    style={{ background: bg, borderColor: border }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.05)", color: helperColor }}>
                        {choice.key}
                      </span>
                      <span className="text-base font-medium md:text-[17px]" style={{ color: textColor }}>{choice.text}</span>
                      {revealed && isCorrect ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" style={{ color: "#4ade80" }} /> : null}
                      {revealed && isPicked && !isCorrect ? <XCircle className="ml-auto h-4 w-4 shrink-0" style={{ color: "#f87171" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {revealed && mode === "tutor" ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[22px] border p-4" style={{ borderColor: isCorrectAnswer ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)", background: isCorrectAnswer ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isCorrectAnswer ? <CheckCircle2 className="h-5 w-5" style={{ color: "#4ade80" }} /> : <XCircle className="h-5 w-5" style={{ color: "#f87171" }} />}
                    <span className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: isCorrectAnswer ? "#86efac" : "#fca5a5" }}>{isCorrectAnswer ? "Correct" : "Incorrect"}</span>
                    <span className="ml-auto text-xs font-semibold" style={{ color: "#c9d3e7" }}>Correct answer: {q.answer_key}</span>
                  </div>
                  <div className="mt-2 text-sm leading-7" style={{ color: "#dce5f4" }}>
                    {isCorrectAnswer ? `You answered ${picked}.` : <>You answered <strong>{picked}</strong>. Correct answer: <strong>{q.answer_key}</strong>.</>}
                  </div>
                </div>

                {details.explanation ? (
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#93c5fd" }}>
                      <BookOpen className="h-4 w-4" /> Explanation
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: "#dce5f4" }}>{details.explanation}</div>
                  </div>
                ) : null}

                {details.educationalObjective ? (
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)" }}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#6ee7b7" }}>
                      <Lightbulb className="h-4 w-4" /> High-yield takeaway
                    </div>
                    <div className="text-sm leading-7" style={{ color: "#dce5f4" }}>{details.educationalObjective}</div>
                  </div>
                ) : null}

                {wrongChoices.length > 0 ? (
                  <details className="rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <summary className="cursor-pointer list-none text-sm font-semibold" style={{ color: "#dce5f4" }}>Why the other choices are incorrect</summary>
                    <div className="mt-3 space-y-2">
                      {wrongChoices.map((choice) => (
                        <div key={choice.key} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: "#aab6ce" }}>{choice.key}</span>
                          <span style={{ color: "#aab6ce" }}>{choice.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {noteOpen ? (
              <div className="mt-5 rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className="input w-full resize-none rounded-2xl text-sm" placeholder="Add a review note for this question…" />
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary text-sm" disabled={!noteText.trim()} onClick={() => void saveLibraryEntry("note", { body: noteText })}>Save note</button>
                  <button className="btn-ghost text-sm" onClick={() => { setNoteOpen(false); setNoteText(""); }}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {!focusMode && contextVisible ? (
          <section className="mt-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(12,18,34,0.96), rgba(8,13,26,0.96))", boxShadow: "0 18px 48px rgba(0,0,0,0.22)" }}>
            <div className="flex items-start justify-between gap-3 border-b px-4 py-4 md:px-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#7f90ae" }}>Context Panel</div>
                <div className="mt-1 text-lg font-semibold text-white">Figure & Tools</div>
              </div>
              <button onClick={() => setContextVisible(false)} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#c9d3e7" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-4 md:px-5">
              <div className="grid gap-2 md:grid-cols-[220px_220px_220px_auto]">
                <button onClick={() => setContextTab("figure")} disabled={!imageHref} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition disabled:opacity-40" style={contextTab === "figure" ? { borderColor: "#2563eb", background: "rgba(37,99,235,0.12)", color: "#93c5fd" } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dce5f4" }}>
                  <ImageIcon className="h-4 w-4" /> Figure
                </button>
                <button onClick={() => setContextTab("labs")} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition" style={contextTab === "labs" ? { borderColor: "#2563eb", background: "rgba(37,99,235,0.12)", color: "#93c5fd" } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dce5f4" }}>
                  <FlaskConical className="h-4 w-4" /> Labs
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(59,130,246,0.18)", color: "#bfdbfe" }}>3</span>
                </button>
                <button onClick={() => setContextTab("calculator")} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition" style={contextTab === "calculator" ? { borderColor: "#2563eb", background: "rgba(37,99,235,0.12)", color: "#93c5fd" } : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dce5f4" }}>
                  <Calculator className="h-4 w-4" /> Calculator
                </button>
                <div />
              </div>

              {contextTab === "figure" ? (
                <div className="mt-4 overflow-hidden rounded-[22px] border" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                  {imageHref ? (
                    <>
                      <button onClick={() => setImageOpen(true)} className="block w-full">
                        <img src={imageHref} alt={q.image_caption || "Figure"} className="max-h-[520px] w-full object-contain" />
                      </button>
                      <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#c9d3e7" }}>
                        <button onClick={() => void saveLibraryEntry("note", { body: `Figure note for question ${i + 1}` })} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                          <PencilLine className="h-3.5 w-3.5" /> Add to notes
                        </button>
                        <button onClick={() => setImageOpen(true)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                          <Expand className="h-3.5 w-3.5" /> Enlarge
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-sm" style={{ color: "#92a2bf" }}>This question has no linked figure.</div>
                  )}
                </div>
              ) : null}

              {contextTab === "labs" ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
                  <div className="rounded-[22px] border p-3" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#7f90ae" }}>Lab categories</div>
                    <div className="space-y-2">
                      {Object.entries(LAB_REFERENCE).map(([category, items]) => (
                        <button key={category} onClick={() => setLabCategory(category)} className="flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-sm font-medium transition" style={labCategory === category ? { background: "rgba(37,99,235,0.18)", color: "#dbeafe" } : { background: "rgba(255,255,255,0.02)", color: "#c9d3e7" }}>
                          <span>{category}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: labCategory === category ? "rgba(147,197,253,0.18)" : "rgba(255,255,255,0.05)", color: labCategory === category ? "#bfdbfe" : "#8fa1be" }}>{items.length}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border p-3 md:p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="mb-3 text-base font-semibold text-white">{labCategory}</div>
                    <div className="overflow-hidden rounded-[18px] border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                      <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "rgba(255,255,255,0.06)", color: "#7f90ae" }}>
                        <div>Test</div>
                        <div>Your value</div>
                        <div>Reference range</div>
                      </div>
                      {labItems.map((item) => (
                        <div key={item.test} className="grid grid-cols-[1.1fr_1fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "rgba(255,255,255,0.05)", color: "#dce5f4" }}>
                          <div>{item.test}</div>
                          <div style={{ color: item.tone === "abnormal" ? "#fca5a5" : "#86efac" }}>{item.value}</div>
                          <div style={{ color: "#aab6ce" }}>{item.ref}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs" style={{ color: "#92a2bf" }}>When question-specific labs are available, abnormal values are highlighted.</div>
                  </div>
                </div>
              ) : null}

              {contextTab === "calculator" ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-base font-semibold text-white">Anion gap</div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <CalcField label="Na⁺" value={calcNa} onChange={setCalcNa} />
                      <CalcField label="Cl⁻" value={calcCl} onChange={setCalcCl} />
                      <CalcField label="HCO₃⁻" value={calcHco3} onChange={setCalcHco3} />
                    </div>
                    <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(59,130,246,0.24)", background: "rgba(37,99,235,0.08)", color: "#dbeafe" }}>
                      Anion gap = <strong>{Number.isFinite(anionGap) ? anionGap : "—"}</strong>
                    </div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-base font-semibold text-white">Quick reference</div>
                    <div className="mt-3 space-y-2 text-sm" style={{ color: "#c9d3e7" }}>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>Normal anion gap: <strong>8 – 12</strong></div>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>Winter’s formula: <strong>1.5 × HCO₃ + 8 ± 2</strong></div>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>Corrected Na⁺ in hyperglycemia: <strong>+1.6 per 100 glucose above 100</strong></div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : !focusMode ? (
          <div className="mt-4 flex justify-end">
            <button onClick={() => setContextVisible(true)} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(12,18,34,0.92)", color: "#dbe6ff" }}>
              <FolderTree className="h-4 w-4" /> Show context panel
            </button>
          </div>
        ) : null}

        {!focusMode ? (
          <section className="mt-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(12,18,34,0.96), rgba(8,13,26,0.96))", boxShadow: "0 18px 48px rgba(0,0,0,0.22)" }}>
            <div className="px-4 py-4 md:px-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#7f90ae" }}>Session status</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatusTile label="Done" value={answered} color="#dce5f4" />
                <StatusTile label="Correct" value={correctCount} color="#4ade80" />
                <StatusTile label="Wrong" value={incorrectCount} color="#f87171" />
              </div>
              <div className="mt-4 rounded-[18px] border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "#aab6ce" }}>
                  <span>Accuracy so far: {accuracy}%</span>
                  <span>{answered}/{questions.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] transition-all" style={{ width: `${accuracy}%` }} />
                </div>
              </div>
            </div>
          </section>
        ) : null}
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
                <button onClick={() => void saveLibraryEntry("note", { body: `Image note for question ${i + 1}` })} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>Add to notes</button>
                <button onClick={() => void saveLibraryEntry("bookmark")} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-blue)" }}>Bookmark</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-4 pt-3 backdrop-blur-xl md:px-6" style={{ background: "rgba(6,11,24,0.88)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="mx-auto flex max-w-[1520px] flex-col gap-2">
          {toolStatus ? <div className="text-center text-xs font-medium" style={{ color: "#93c5fd" }}>{toolStatus}</div> : null}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button onClick={prev} disabled={i <= 0} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-40 md:min-w-[180px]" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dce5f4" }}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button onClick={() => setNoteOpen((v) => !v)} className="flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold md:min-w-[180px]" style={{ borderColor: "rgba(255,255,255,0.08)", background: noteOpen ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)", color: noteOpen ? "#93c5fd" : "#dce5f4" }}>
              <PencilLine className="h-4 w-4" /> Review
            </button>
            <div className="md:flex-1" />
            {!revealed ? (
              <button className="btn-primary h-12 rounded-2xl px-8 text-base md:min-w-[200px]" disabled={!picked} onClick={() => void submit()}>
                Reveal Answer
              </button>
            ) : (
              <button className="btn-primary h-12 rounded-2xl px-8 text-base md:min-w-[200px]" onClick={next}>
                Next <ChevronRight className="ml-1 h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "#8ea1bf" }}>
            <button onClick={() => void saveLibraryEntry("highlight")} disabled={toolBusy === "highlight"} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <Highlighter className="h-3.5 w-3.5" /> Highlight
            </button>
            <button onClick={() => void saveLibraryEntry("bookmark")} disabled={toolBusy === "bookmark"} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <BookmarkPlus className="h-3.5 w-3.5" /> Bookmark
            </button>
            <button onClick={() => setContextVisible((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <FolderTree className="h-3.5 w-3.5" /> {contextVisible ? "Hide" : "Show"} context
            </button>
            <Link href="/notifications" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <Bell className="h-3.5 w-3.5" /> Alerts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function StatusTile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-[18px] border px-4 py-4 text-center" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#8ea1bf" }}>{label}</div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--c-border)", background: "var(--c-elevated)" }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--c-text-4)" }}>{label}</div>
    </div>
  );
}

function CalcField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#7f90ae" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#dce5f4" }} />
    </label>
  );
}
