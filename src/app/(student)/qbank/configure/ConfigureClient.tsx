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
  Target,
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
  {
    value: "tutor",
    label: "Tutor",
    desc: "Show explanations",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    value: "timed",
    label: "Timed",
    desc: "90 sec/question",
    icon: <Clock className="h-5 w-5" />,
  },
  {
    value: "exam",
    label: "Mock Exam",
    desc: "Full simulation",
    icon: <BookOpen className="h-5 w-5" />,
  },
];

export default function ConfigureClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = sp.get("subject") || "";
  const exam = sp.get("exam") || "IFOM_CSE";
  const course = sp.get("course") || "";
  const returnTo = sp.get("returnTo") || `/qbank?exam=${encodeURIComponent(exam)}${course ? `&course=${encodeURIComponent(course)}` : ""}`;

  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<Mode>("tutor");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [selectedExam, setSelectedExam] = useState(exam);
  const [selectedSubject, setSelectedSubject] = useState(subject);

  const summaryExam = selectedExam === "All Exams" ? "All exams" : selectedExam.replaceAll("_", " ");
  const summarySubject = selectedSubject || (course ? "Course question pool" : "All mixed");

  function start() {
    const params = new URLSearchParams();
    if (selectedSubject) params.set("subject", selectedSubject);
    if (course) params.set("course", course);
    if (selectedExam && selectedExam !== "All Exams") params.set("exam", selectedExam);
    params.set("count", String(count));
    params.set("mode", mode);
    params.set("difficulty", difficulty);
    if (returnTo) params.set("returnTo", returnTo);
    router.push(`/qbank?${params.toString()}`);
  }

  const estimatedMinutes = useMemo(() => Math.ceil(count * (mode === "timed" ? 1.1 : 1.5)), [count, mode]);

  return (
    <div className="page-shell max-w-2xl mx-auto pb-32 sm:pb-24">
      <Link
        href={returnTo}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="overflow-hidden rounded-[30px] border border-ink-800 bg-[#08101f] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand border border-brand/20">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Configure Your Quiz</h1>
              <p className="mt-1 text-sm text-slate-400">Match the session to your exact study goal.</p>
            </div>
          </div>
          <div className="hidden sm:grid h-11 w-11 place-items-center rounded-2xl border border-ink-800 bg-ink-900 text-slate-400">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-7 p-5">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Quiz Mode</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setMode(item.value)}
                  className={`rounded-[22px] border p-4 text-left transition ${
                    mode === item.value
                      ? "border-brand bg-brand/10 text-white"
                      : "border-ink-800 bg-ink-900 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl ${mode === item.value ? "bg-brand/15 text-brand" : "bg-[#0b1220] text-slate-500"}`}>
                    {item.icon}
                  </div>
                  <div className="mt-4 text-lg font-semibold">{item.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Target Exam</h2>
            <div className="flex flex-wrap gap-2">
              {EXAMS.map((item) => {
                const active = selectedExam === item;
                return (
                  <button
                    key={item}
                    onClick={() => setSelectedExam(item)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                        : "border-ink-800 bg-ink-900 text-slate-400 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {item.replaceAll("_", " ")}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Subjects</h2>
            <p className="mb-3 text-sm text-slate-500">Optional — leave blank for mixed practice.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUBJECTS.map((item) => {
                const active = selectedSubject === item;
                return (
                  <button
                    key={item}
                    onClick={() => setSelectedSubject(active ? "" : item)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      active
                        ? "border-brand bg-brand/10 text-white"
                        : "border-ink-800 bg-ink-900 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Difficulty</h2>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((item) => {
                const active = difficulty === item;
                return (
                  <button
                    key={item}
                    onClick={() => setDifficulty(item)}
                    className={`rounded-2xl border px-5 py-2.5 text-sm font-medium capitalize transition ${
                      active
                        ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                        : "border-ink-800 bg-ink-900 text-slate-400 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Number of Questions</h2>
            <div className="flex flex-wrap gap-3">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`min-w-[72px] rounded-2xl border px-5 py-3 text-base font-semibold transition ${
                    count === n
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-ink-800 bg-ink-900 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          <div className="rounded-[24px] border border-ink-800 bg-ink-900 p-5 text-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryItem label="Mode" value={MODES.find((m) => m.value === mode)?.label || mode} />
              <SummaryItem label="Questions" value={String(count)} />
              <SummaryItem label="Subject" value={summarySubject} />
              <SummaryItem label="Exam" value={summaryExam} />
            </div>
            <div className="mt-4 text-slate-500">Estimated time: ~{estimatedMinutes} min</div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-ink-800 bg-ink-950/92 p-4 backdrop-blur-xl md:absolute md:mx-auto md:max-w-2xl">
        <button
          onClick={start}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#22d3ee,#3b82f6)] px-4 py-4 text-base font-semibold text-white"
        >
          <Play className="h-5 w-5 fill-current" />
          Start Session
        </button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}
