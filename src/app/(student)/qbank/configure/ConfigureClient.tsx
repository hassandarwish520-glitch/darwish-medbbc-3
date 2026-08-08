"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Filter,
  GraduationCap,
  Play,
  SlidersHorizontal,
  FolderTree,
  Shuffle,
  Bookmark,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const COUNT_OPTIONS = [5, 10, 20, 30, 40, 60, 80];
const EXAMS = ["All Exams", "IFOM_CSE", "USMLE_CK", "PLAB", "AMC", "SMLE", "DHA", "HAAD", "QCHP", "PROMETRIC"];
const SUBJECTS = [
  "Cardiology",
  "Respiratory System",
  "Neurology",
  "Endocrine",
  "Hematology",
  "Infectious Diseases",
  "Pediatrics",
  "Obstetrics",
  "Gynecology",
  "Psychiatry",
  "Dermatology",
  "Renal & Urogenital",
  "Rheumatology & Orthopedics",
  "Biostatistics",
];
const DIFFICULTIES = ["all", "foundation", "intermediate", "advanced", "expert"] as const;

type Mode = "tutor" | "exam" | "timed";
type Difficulty = (typeof DIFFICULTIES)[number];

const MODES: { value: Mode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "tutor", label: "Tutor", desc: "Reveal explanations immediately", icon: <GraduationCap className="h-5 w-5" /> },
  { value: "timed", label: "Timed", desc: "Fast-paced practice block", icon: <Clock className="h-5 w-5" /> },
  { value: "exam", label: "Mock Exam", desc: "Simulate real exam pressure", icon: <BookOpen className="h-5 w-5" /> },
];

export default function ConfigureClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = sp.get("subject") || "";
  const exam = sp.get("exam") || "IFOM_CSE";
  const course = sp.get("course") || "";
  const filter = sp.get("filter") || "";
  const returnTo = sp.get("returnTo") || `/qbank?exam=${encodeURIComponent(exam)}${course ? `&course=${encodeURIComponent(course)}` : ""}`;

  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<Mode>((sp.get("mode") as Mode) || "tutor");
  const [difficulty, setDifficulty] = useState<Difficulty>((sp.get("difficulty") as Difficulty) || "all");
  const [selectedExam, setSelectedExam] = useState(exam);
  const [selectedSubject, setSelectedSubject] = useState(subject);

  const summaryExam = selectedExam === "All Exams" ? "All exams" : selectedExam.replaceAll("_", " ");
  const summarySubject = selectedSubject || (course ? "Course question pool" : "All mixed");
  const filterLabel = filter === "incorrect" ? "Incorrect only" : filter === "bookmarked" ? "Bookmarked only" : "All eligible questions";

  function start() {
    const params = new URLSearchParams();
    if (selectedSubject) params.set("subject", selectedSubject);
    if (course) params.set("course", course);
    if (filter) params.set("filter", filter);
    if (selectedExam && selectedExam !== "All Exams") params.set("exam", selectedExam);
    params.set("count", String(count));
    params.set("mode", mode);
    params.set("difficulty", difficulty);
    if (returnTo) params.set("returnTo", returnTo);
    router.push(`/qbank?${params.toString()}`);
  }

  const estimatedMinutes = useMemo(() => Math.ceil(count * (mode === "timed" ? 1.1 : mode === "exam" ? 1.4 : 1.5)), [count, mode]);

  return (
    <div className="page-shell mx-auto max-w-6xl pb-32 sm:pb-24">
      <Link href={returnTo} className="mb-6 inline-flex items-center gap-2 text-sm transition" style={{ color: "var(--c-text-3)" }}>
        <ArrowLeft className="h-4 w-4" />
        Back to QBank
      </Link>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="overflow-hidden rounded-[32px] border" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-elevated)" }}>
          <div className="border-b px-5 py-5 sm:px-6" style={{ borderColor: "var(--c-border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "rgba(37,99,235,0.10)", color: "var(--c-blue)" }}>
                <Filter className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Configure random question session</h1>
                <p className="mt-1 text-sm" style={{ color: "var(--c-text-4)" }}>Tune the practice set without changing the original fixed blocks.</p>
              </div>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-6">
            <section>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Session mode</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {MODES.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setMode(item.value)}
                    className="rounded-[22px] border p-4 text-left transition"
                    style={mode === item.value
                      ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.08)", color: "var(--c-text-1)" }
                      : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-2xl" style={mode === item.value ? { background: "rgba(37,99,235,0.12)", color: "var(--c-blue)" } : { background: "var(--c-card)", color: "var(--c-text-4)" }}>
                      {item.icon}
                    </div>
                    <div className="mt-4 text-lg font-semibold">{item.label}</div>
                    <div className="mt-1 text-sm" style={{ color: "var(--c-text-4)" }}>{item.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Target exam</h2>
              <div className="flex flex-wrap gap-2">
                {EXAMS.map((item) => {
                  const active = selectedExam === item;
                  return (
                    <button
                      key={item}
                      onClick={() => setSelectedExam(item)}
                      className="rounded-full border px-4 py-2 text-sm font-medium transition"
                      style={active
                        ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.10)", color: "var(--c-blue)" }
                        : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
                    >
                      {item.replaceAll("_", " ")}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Subjects</h2>
              <p className="mb-3 text-sm" style={{ color: "var(--c-text-4)" }}>Optional — keep blank for mixed clinical practice.</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {SUBJECTS.map((item) => {
                  const active = selectedSubject === item;
                  return (
                    <button
                      key={item}
                      onClick={() => setSelectedSubject(active ? "" : item)}
                      className="rounded-2xl border px-4 py-3 text-left text-sm transition"
                      style={active
                        ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.08)", color: "var(--c-text-1)" }
                        : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Difficulty</h2>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((item) => {
                  const active = difficulty === item;
                  return (
                    <button
                      key={item}
                      onClick={() => setDifficulty(item)}
                      className="rounded-2xl border px-5 py-2.5 text-sm font-medium capitalize transition"
                      style={active
                        ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.10)", color: "var(--c-blue)" }
                        : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-3)" }}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Question count</h2>
              <div className="flex flex-wrap gap-3">
                {COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className="min-w-[72px] rounded-2xl border px-5 py-3 text-base font-semibold transition"
                    style={count === n
                      ? { borderColor: "var(--c-blue)", background: "rgba(37,99,235,0.10)", color: "var(--c-blue)" }
                      : { borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[32px] border p-5 sm:p-6" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: filter === "incorrect" ? "rgba(239,68,68,0.10)" : filter === "bookmarked" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.10)", color: filter === "incorrect" ? "#ef4444" : filter === "bookmarked" ? "#d97706" : "#059669" }}>
                {filter === "incorrect" ? <XCircle className="h-5 w-5" /> : filter === "bookmarked" ? <Bookmark className="h-5 w-5" /> : <Shuffle className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Session summary</div>
                <div className="mt-1 text-xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>Ready to start</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryRow label="Mode" value={MODES.find((m) => m.value === mode)?.label || mode} />
              <SummaryRow label="Exam" value={summaryExam} />
              <SummaryRow label="Subject" value={summarySubject} />
              <SummaryRow label="Filter" value={filterLabel} />
              <SummaryRow label="Questions" value={String(count)} />
              <SummaryRow label="Estimated time" value={`~${estimatedMinutes} min`} />
            </div>
          </div>

          <div className="rounded-[32px] border p-5 sm:p-6" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-card)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--c-text-4)" }}>Architectural intent</div>
            <div className="mt-2 space-y-3 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
              <div className="flex items-start gap-3">
                <FolderTree className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--c-blue)" }} />
                <span>Fixed blocks remain intact and reviewable in their original subject context.</span>
              </div>
              <div className="flex items-start gap-3">
                <Shuffle className="mt-1 h-4 w-4 shrink-0" style={{ color: "#059669" }} />
                <span>Random sessions create a new practice slice from the same question database.</span>
              </div>
              <div className="flex items-start gap-3">
                <SlidersHorizontal className="mt-1 h-4 w-4 shrink-0" style={{ color: "#7c3aed" }} />
                <span>Filters narrow access to questions without duplicating or moving them.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t p-4 backdrop-blur-xl md:static md:mt-5 md:border-0 md:bg-transparent md:p-0" style={{ borderColor: "var(--c-border)", background: "var(--c-header-bg)" }}>
        <button onClick={start} className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base">
          <Play className="h-5 w-5 fill-current" />
          Start random session
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ background: "var(--c-elevated)", borderColor: "var(--c-border)" }}>
      <span className="text-sm" style={{ color: "var(--c-text-4)" }}>{label}</span>
      <span className="text-sm font-semibold text-right" style={{ color: "var(--c-text-1)" }}>{value}</span>
    </div>
  );
}
