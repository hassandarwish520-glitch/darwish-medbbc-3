"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  MailCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

type Summary = {
  unread_count: number;
  due_count: number;
  new_lessons_count: number;
  pending_approvals: number;
  unconfirmed_emails: number;
  due_reminders: { title: string }[];
  recent_lessons: { id: string; title: string; created_at: string }[];
};

type LocalReminder = {
  id: string;
  title: string;
  when: string;
  slot: string;
  fired?: boolean;
};

type ScheduleEntry = {
  id: string;
  day: string;
  hour: string;
  subject: string;
  task?: string;
};

type WarNote = {
  id: string;
  subject: string;
  content: string;
  createdAt: string;
};

const STORAGE_KEY = "medbbc.local.study.reminders.v1";
const SLOT_KEY = "medbbc.local.study.slot.v1";
const EXAM_DATE_KEY = "medbbc.local.exam.date.v1";
const SCHEDULE_KEY = "medbbc.local.study.schedule.v2";
const WAR_NOTES_KEY = "medbbc.local.war.notes.v1";

const SLOT_OPTIONS = [
  { value: "after-fajr", label: "After Fajr" },
  { value: "morning", label: "Morning (7–9 am)" },
  { value: "afternoon", label: "Afternoon (1–3 pm)" },
  { value: "evening", label: "Evening (5–7 pm)" },
  { value: "night", label: "Night (9–11 pm)" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 5;
  const ampm = h < 12 ? "AM" : "PM";
  const label = h === 12 ? 12 : h > 12 ? h - 12 : h;
  return { value: `${h}:00`, label: `${label}:00 ${ampm}` };
});

const IFOM_SUBJECTS = [
  "Cardiology", "Respiratory", "Gastroenterology", "Nephrology & Urology",
  "Neurology", "Endocrine", "Hematology", "Musculoskeletal", "Dermatology",
  "Psychiatry", "Obstetrics", "Gynecology", "Pediatrics", "Statistics & Epidemiology",
  "Pharmacology", "Infectious Disease",
];

const MOTIVATIONAL_QUOTES = [
  "You are one day closer to your exam. Every concept you master now saves you in the exam hall.",
  "The best students don't study harder — they study smarter. You are already doing the right thing.",
  "Medicine rewards those who show up consistently. You showed up today. That matters.",
  "Each flashcard you review is a patient you will care for better in the future.",
  "Progress is not always visible, but it is always real. Keep going.",
  "The exam is a door. Your daily study is the key. You are building it, piece by piece.",
  "Rest when you must, study when you can — but never give up on the mission.",
];

function loadReminders(): LocalReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function saveReminders(list: LocalReminder[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadSchedule(): ScheduleEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(SCHEDULE_KEY) || "[]");
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function saveSchedule(list: ScheduleEntry[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list));
}

function loadWarNotes(): WarNote[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(WAR_NOTES_KEY) || "[]");
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function saveWarNotes(list: WarNote[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(WAR_NOTES_KEY, JSON.stringify(list));
}

async function fireNotification(title: string, body: string) {
  try {
    if ("serviceWorker" in navigator && Notification.permission === "granted") {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: "/favicon.ico" });
      return;
    }
  } catch { /* fall through */ }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days <= 3) return "text-rose-500";
  if (days <= 7) return "text-amber-500";
  if (days <= 14) return "text-yellow-500";
  return "text-brand";
}

function downloadScheduleAsCSV(schedule: ScheduleEntry[]) {
  const rows = [
    ["Day", "Hour", "Subject", "Task"],
    ...DAYS.flatMap((d) =>
      schedule
        .filter((e) => e.day === d)
        .sort((a, b) => a.hour.localeCompare(b.hour))
        .map((e) => [e.day, e.hour, e.subject, e.task || ""])
    ),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "study-schedule.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function NotificationsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<string>("default");
  const [slot, setSlot] = useState("after-fajr");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [reminders, setReminders] = useState<LocalReminder[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const swRegistered = useRef(false);

  // Exam date
  const [examDate, setExamDate] = useState("");
  const [examSaved, setExamSaved] = useState(false);
  const [quoteIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));

  // Schedule
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleDay, setScheduleDay] = useState(DAYS[0]);
  const [scheduleHour, setScheduleHour] = useState(HOURS[3].value);
  const [scheduleSubject, setScheduleSubject] = useState(IFOM_SUBJECTS[0]);
  const [scheduleTask, setScheduleTask] = useState("");
  const [scheduleTab, setScheduleTab] = useState<"view" | "add">("view");

  // War notes
  const [warNotes, setWarNotes] = useState<WarNote[]>([]);
  const [warNoteSubject, setWarNoteSubject] = useState(IFOM_SUBJECTS[0]);
  const [warNoteContent, setWarNoteContent] = useState("");
  const [showWarNoteForm, setShowWarNoteForm] = useState(false);

  /* Bootstrap */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window) setPermission(Notification.permission);
    setSlot(window.localStorage.getItem(SLOT_KEY) || "after-fajr");
    setReminders(loadReminders());
    setExamDate(window.localStorage.getItem(EXAM_DATE_KEY) || "");
    fetch("/api/exam-settings", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (typeof data.exam_date === "string" && data.exam_date) {
          setExamDate(data.exam_date);
          window.localStorage.setItem(EXAM_DATE_KEY, data.exam_date);
        }
        if (typeof data.reminder_slot === "string" && data.reminder_slot) {
          setSlot(data.reminder_slot);
        }
      })
      .catch(() => {});
    setSchedule(loadSchedule());
    setWarNotes(loadWarNotes());
    if ("serviceWorker" in navigator && !swRegistered.current) {
      swRegistered.current = true;
      navigator.serviceWorker.register("/sw.js").catch(() => {/* silent */});
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SLOT_KEY, slot);
  }, [slot]);

  useEffect(() => {
    if (typeof window !== "undefined") saveReminders(reminders);
  }, [reminders]);

  useEffect(() => {
    if (typeof window !== "undefined") saveSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    if (typeof window !== "undefined") saveWarNotes(warNotes);
  }, [warNotes]);

  useEffect(() => {
    fetch("/api/notifications/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .finally(() => setLoading(false));
  }, []);

  /* Reminder tick */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      const now = Date.now();

      // Check regular reminders
      setReminders((current) => {
        let changed = false;
        const next = current.map((item) => {
          if (!item.fired && new Date(item.when).getTime() <= now) {
            void fireNotification("Darwish MedBBC — Study Reminder", item.title);
            changed = true;
            return { ...item, fired: true };
          }
          return item;
        });
        return changed ? next : current;
      });

      // Check exam pre-alerts
      const savedExam = window.localStorage.getItem(EXAM_DATE_KEY) || "";
      if (savedExam) {
        const days = daysUntil(savedExam);
        const alertKey14 = `medbbc.examAlert.14.${savedExam}`;
        const alertKey7  = `medbbc.examAlert.7.${savedExam}`;
        const alertKey3  = `medbbc.examAlert.3.${savedExam}`;
        const alertKey1  = `medbbc.examAlert.1.${savedExam}`;

        if (days !== null && days === 14 && !localStorage.getItem(alertKey14)) {
          void fireNotification(
            "📋 2 Weeks to Your IFOM CSE!",
            "14 days left — open your War Notes now to write the expected questions and focus topics for each subject."
          );
          localStorage.setItem(alertKey14, "1");
        }
        if (days !== null && days === 7 && !localStorage.getItem(alertKey7)) {
          void fireNotification("⚡ 1 Week to Your Exam!", "7 days left — review your weakest subjects and do timed practice blocks today.");
          localStorage.setItem(alertKey7, "1");
        }
        if (days !== null && days === 3 && !localStorage.getItem(alertKey3)) {
          void fireNotification("🔥 3 Days to Your Exam!", "Final sprint — avoid new topics, reinforce what you know. Flashcard review now.");
          localStorage.setItem(alertKey3, "1");
        }
        if (days !== null && days === 1 && !localStorage.getItem(alertKey1)) {
          void fireNotification("🎯 Exam Tomorrow!", "Rest well tonight. You have prepared — trust your training.");
          localStorage.setItem(alertKey1, "1");
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* Actions */
  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if ("serviceWorker" in navigator) {
      try { await navigator.serviceWorker.register("/sw.js"); } catch {/* ok */}
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await fireNotification("MedBBC notifications active ✓", "Study reminders and exam alerts will appear here.");
    }
  }

  function addReminder() {
    if (!title.trim() || !when) { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 2500); return; }
    setReminders((list) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), when, slot, fired: false }, ...list]);
    setTitle("");
    setWhen("");
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  function removeReminder(id: string) { setReminders((l) => l.filter((r) => r.id !== id)); }

  async function saveExamDate() {
    if (typeof window !== "undefined") window.localStorage.setItem(EXAM_DATE_KEY, examDate);
    try {
      await fetch("/api/exam-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam_date: examDate, reminder_slot: slot }),
      });
      setExamSaved(true);
      setTimeout(() => setExamSaved(false), 2000);
    } catch {
      setExamSaved(false);
    }
  }

  function addScheduleEntry() {
    if (!scheduleDay || !scheduleHour || !scheduleSubject) return;
    setSchedule((list) => [
      ...list,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        day: scheduleDay,
        hour: scheduleHour,
        subject: scheduleSubject,
        task: scheduleTask.trim() || undefined,
      },
    ]);
    setScheduleTask("");
    setScheduleTab("view");
  }

  function removeScheduleEntry(id: string) { setSchedule((l) => l.filter((e) => e.id !== id)); }

  function addWarNote() {
    if (!warNoteContent.trim()) return;
    setWarNotes((list) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        subject: warNoteSubject,
        content: warNoteContent.trim(),
        createdAt: new Date().toISOString(),
      },
      ...list,
    ]);
    setWarNoteContent("");
    setShowWarNoteForm(false);
  }

  function removeWarNote(id: string) { setWarNotes((l) => l.filter((n) => n.id !== id)); }

  const upcoming = useMemo(
    () => reminders.slice().sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime()),
    [reminders],
  );

  const daysLeft = daysUntil(examDate);
  const uColor = urgencyColor(daysLeft);

  const groupedSchedule = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    DAYS.forEach((d) => {
      const entries = schedule.filter((e) => e.day === d).sort((a, b) => a.hour.localeCompare(b.hour));
      if (entries.length) map.set(d, entries);
    });
    return map;
  }, [schedule]);

  const permissionColor =
    permission === "granted" ? "text-emerald-500 dark:text-emerald-400"
    : permission === "denied" ? "text-rose-500"
    : "text-amber-500";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 pb-16">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
        style={{ color: "var(--c-text-3)" }}>
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* ── Exam Countdown ─────────────────────────────────────────── */}
      <div className="card p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl shrink-0"
            style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
            <Target className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>IFOM CSE Exam Date</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--c-text-3)" }}>
              Set your exam date — reminders fire at 14, 7, 3, and 1 day(s) before your exam.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            className="input flex-1"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={saveExamDate} disabled={!examDate}>
            {examSaved ? <><CheckCircle2 className="h-4 w-4" /> Saved</> : "Save exam date"}
          </button>
        </div>

        {examDate && daysLeft !== null && (
          <div className="mt-4 rounded-2xl p-4" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
            {daysLeft < 0 ? (
              <div className="text-sm font-medium" style={{ color: "var(--c-text-3)" }}>Your exam date has passed. Update it above when your next exam is scheduled.</div>
            ) : daysLeft === 0 ? (
              <div>
                <div className={`text-3xl font-black ${uColor}`}>Exam Day!</div>
                <div className="mt-1 text-sm" style={{ color: "var(--c-text-2)" }}>You have prepared for this. Trust your training and stay calm.</div>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-black ${uColor}`}>{daysLeft}</span>
                  <span className="text-lg font-semibold" style={{ color: "var(--c-text-2)" }}>days remaining</span>
                </div>
                <div className="mt-2 text-sm" style={{ color: "var(--c-text-3)" }}>
                  {new Date(examDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>

                {/* Increase study hours nudge */}
                {daysLeft <= 30 && daysLeft > 14 && (
                  <div className="mt-3 rounded-xl p-3 text-sm"
                    style={{ background: "var(--c-blue-bg)", border: "1px solid var(--c-blue-border)", color: "var(--c-blue)" }}>
                    <div className="font-semibold mb-1">📈 Consider increasing your daily study hours</div>
                    With {daysLeft} days left, aim for at least 4–6 hours per day. Add extra sessions to your schedule below.
                  </div>
                )}

                {daysLeft <= 14 && (
                  <div className="mt-3 rounded-xl p-3 text-sm"
                    style={{ background: "var(--c-brand-bg)", border: "1px solid var(--c-brand-border)", color: "var(--c-brand)" }}>
                    <div className="font-semibold mb-1">
                      {daysLeft <= 7 ? "🔥 Final week — high-yield priority" : "📋 2-week sprint — write your War Notes now"}
                    </div>
                    {daysLeft <= 7
                      ? "Do timed blocks, full practice sessions, and rapid flashcard review. Prioritize: Cardiology, Respiratory, Pharmacology, Neurology."
                      : "Write expected questions and focus topics in your War Notes (below). Use the Q-Bank for mixed practice and flag weak topics."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Motivational quote */}
        <div className="mt-4 rounded-xl px-4 py-3 text-sm italic"
          style={{ background: "var(--c-elevated)", color: "var(--c-text-2)", borderLeft: "3px solid var(--c-brand)" }}>
          <Flame className="inline h-4 w-4 mr-1.5 mb-0.5" style={{ color: "var(--c-brand)" }} />
          {MOTIVATIONAL_QUOTES[quoteIdx]}
        </div>
      </div>

      {/* ── War Notes (Exam Preparation Book) ──────────────────────── */}
      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl shrink-0"
              style={{ background: "var(--c-purple-bg)", color: "var(--c-purple)" }}>
              <BookOpenCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--c-text-1)" }}>War Notes — Exam Book</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--c-text-3)" }}>
                Private notes for expected questions and focus topics. Saved only on this device — not shared online.
              </p>
            </div>
          </div>
          <button
            className={`btn-ghost text-xs py-1.5 px-3 shrink-0 ${showWarNoteForm ? "btn-primary" : ""}`}
            onClick={() => setShowWarNoteForm((v) => !v)}
          >
            <Plus className="h-3 w-3 inline mr-1" />
            Add note
          </button>
        </div>

        {showWarNoteForm && (
          <div className="rounded-xl p-4 mb-4 space-y-3"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-purple-border)" }}>
            <div>
              <label className="label">Subject</label>
              <select className="input mt-1" value={warNoteSubject} onChange={(e) => setWarNoteSubject(e.target.value)}>
                {IFOM_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Expected questions &amp; focus areas</label>
              <textarea
                className="input mt-1 min-h-[120px] resize-y"
                placeholder="e.g. ACS management steps, ECG interpretation in acute MI, troponin timing..."
                value={warNoteContent}
                onChange={(e) => setWarNoteContent(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost text-xs" onClick={() => { setShowWarNoteForm(false); setWarNoteContent(""); }}>Cancel</button>
              <button className="btn-primary text-xs" disabled={!warNoteContent.trim()} onClick={addWarNote}>
                <ShieldCheck className="h-3.5 w-3.5" /> Save to War Notes
              </button>
            </div>
          </div>
        )}

        {warNotes.length === 0 ? (
          <div className="rounded-xl px-4 py-6 text-center text-sm"
            style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
            No war notes yet. Tap "Add note" to write expected questions and focus topics for your exam.
          </div>
        ) : (
          <div className="space-y-3">
            {warNotes.map((note) => (
              <div key={note.id} className="rounded-xl p-4"
                style={{ background: "var(--c-elevated)", border: "1px solid var(--c-purple-border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider mb-1"
                      style={{ color: "var(--c-purple)" }}>{note.subject}</div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--c-text-2)" }}>
                      {note.content}
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: "var(--c-text-4)" }}>
                      {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <button className="hover:opacity-60 transition-opacity shrink-0 mt-0.5"
                    onClick={() => removeWarNote(note.id)}>
                    <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--c-text-4)" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        {/* ── Left column ───────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Live updates */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: "var(--c-text-1)" }}>Notifications Center</h1>
                <p className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>
                  Track reminders, study content, and admin actions from one place.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Unread" value={loading ? "…" : String(summary?.unread_count ?? 0)} icon={<Bell className="h-4 w-4" />} />
              <Metric label="Due reviews" value={loading ? "…" : String(summary?.due_count ?? 0)} icon={<CalendarClock className="h-4 w-4" />} />
              <Metric label="New lessons" value={loading ? "…" : String(summary?.new_lessons_count ?? 0)} icon={<Sparkles className="h-4 w-4" />} />
            </div>
          </div>

          <div className="card p-5">
            <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Live updates</div>
            <div className="mt-3 space-y-2">
              {(summary?.due_reminders ?? []).length ? (
                summary?.due_reminders.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-xl px-4 py-3 text-sm"
                    style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}>
                    {item.title}
                  </div>
                ))
              ) : (
                <div className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
                  No new alerts right now.
                </div>
              )}
            </div>

            {(summary?.recent_lessons ?? []).length ? (
              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>Recently added lessons</div>
                <div className="space-y-2">
                  {summary?.recent_lessons.map((lesson) => (
                    <Link key={lesson.id} href={`/lesson/${lesson.id}`}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:opacity-80"
                      style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}>
                      <BookOpen className="h-4 w-4 shrink-0" style={{ color: "var(--c-brand)" }} />
                      {lesson.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Study Schedule ─────────────────────────────────────── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" style={{ color: "var(--c-brand)" }} />
                <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Study Schedule</div>
              </div>
              <div className="flex items-center gap-2">
                {schedule.length > 0 && (
                  <button
                    className="btn-ghost text-xs py-1.5 px-3"
                    onClick={() => downloadScheduleAsCSV(schedule)}
                  >
                    <Download className="h-3 w-3" /> Export
                  </button>
                )}
                <button
                  className={`text-xs py-1.5 px-3 rounded-lg font-semibold transition ${scheduleTab === "add" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setScheduleTab(scheduleTab === "add" ? "view" : "add")}
                >
                  <Plus className="h-3 w-3 inline mr-1" />
                  Add slot
                </button>
              </div>
            </div>

            {scheduleTab === "add" && (
              <div className="rounded-xl p-4 mb-4 space-y-3"
                style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Day</label>
                    <select className="input mt-1" value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)}>
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Hour</label>
                    <select className="input mt-1" value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)}>
                      {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Subject</label>
                    <select className="input mt-1" value={scheduleSubject} onChange={(e) => setScheduleSubject(e.target.value)}>
                      {IFOM_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Daily task <span style={{ color: "var(--c-text-4)" }}>(optional — what to complete this session)</span></label>
                  <input
                    className="input mt-1"
                    placeholder="e.g. Complete 40 Q-Bank questions on ACS + review flashcards"
                    value={scheduleTask}
                    onChange={(e) => setScheduleTask(e.target.value)}
                  />
                </div>
                <button className="btn-primary w-full" onClick={addScheduleEntry}>
                  <Plus className="h-4 w-4" /> Add to schedule
                </button>
              </div>
            )}

            {groupedSchedule.size === 0 ? (
              <div className="rounded-xl px-4 py-6 text-center text-sm"
                style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
                No schedule yet — tap "Add slot" to build your weekly study plan.
              </div>
            ) : (
              <div className="space-y-4">
                {DAYS.filter((d) => groupedSchedule.has(d)).map((day) => (
                  <div key={day}>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--c-text-3)" }}>{day}</div>
                    <div className="space-y-2">
                      {groupedSchedule.get(day)!.map((entry) => (
                        <div key={entry.id} className="rounded-xl px-4 py-3"
                          style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className="text-xs font-mono font-semibold shrink-0 mt-0.5" style={{ color: "var(--c-brand)" }}>{entry.hour}</span>
                              <div className="min-w-0">
                                <div className="text-sm font-medium" style={{ color: "var(--c-text-1)" }}>{entry.subject}</div>
                                {entry.task && (
                                  <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--c-text-3)" }}>
                                    ✓ {entry.task}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button className="hover:opacity-60 transition-opacity shrink-0 mt-0.5" onClick={() => removeScheduleEntry(entry.id)}>
                              <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--c-text-4)" }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Browser notifications */}
          <div className="card p-5">
            <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Browser notifications</div>
            <p className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>
              Enable alerts so study reminders appear even when the screen is locked.
            </p>
            <div className="mt-3 rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
              Status:{" "}
              <span className={`font-semibold ${permissionColor}`}>
                {permission === "granted"
                  ? "Enabled ✓"
                  : permission === "denied"
                  ? "Blocked — follow steps below"
                  : "Not enabled yet"}
              </span>
            </div>

            {permission !== "denied" && (
              <button className="btn-primary mt-3 w-full" onClick={() => void enableNotifications()}>
                <Bell className="h-4 w-4" />
                {permission === "granted" ? "Send test notification" : "Enable notifications"}
              </button>
            )}

            {permission === "denied" && (
              <div className="mt-3 rounded-xl p-4 space-y-3"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: "#b91c1c" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Notifications are blocked — how to fix:
                </div>
                <ol className="text-xs space-y-2 list-none" style={{ color: "var(--c-text-2)" }}>
                  <li className="flex gap-2"><span className="font-bold shrink-0" style={{ color: "var(--c-brand)" }}>1.</span>Tap the <strong>lock icon</strong> (🔒) or <strong>info icon</strong> (ⓘ) in the address bar of your browser.</li>
                  <li className="flex gap-2"><span className="font-bold shrink-0" style={{ color: "var(--c-brand)" }}>2.</span>Select <strong>Site settings</strong> or <strong>Permissions</strong>.</li>
                  <li className="flex gap-2"><span className="font-bold shrink-0" style={{ color: "var(--c-brand)" }}>3.</span>Find <strong>Notifications</strong> and change it from <em>Block</em> to <strong>Allow</strong>.</li>
                  <li className="flex gap-2"><span className="font-bold shrink-0" style={{ color: "var(--c-brand)" }}>4.</span>Reload this page, then tap "Enable notifications".</li>
                </ol>
                <p className="text-xs" style={{ color: "var(--c-text-3)" }}>
                  On Chrome Android: tap the three-dot menu → Settings → Site settings → Notifications → find this site and set to Allow.
                </p>
              </div>
            )}
          </div>

          {/* Preferred study time */}
          <div className="card p-5">
            <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Preferred study time</div>
            <p className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>Reminders will fire closest to your preferred slot.</p>
            <select className="input mt-3" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Admin alerts */}
          {(summary?.pending_approvals || summary?.unconfirmed_emails) ? (
            <div className="card p-5 space-y-2">
              <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Admin alerts</div>
              {!!summary?.pending_approvals && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}>
                  <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--c-brand)" }} />
                  {summary.pending_approvals} student{summary.pending_approvals !== 1 ? "s" : ""} pending approval
                </div>
              )}
              {!!summary?.unconfirmed_emails && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-2)" }}>
                  <MailCheck className="h-4 w-4 shrink-0" style={{ color: "var(--c-blue)" }} />
                  {summary.unconfirmed_emails} unconfirmed email{summary.unconfirmed_emails !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          ) : null}

          {/* Create a study reminder */}
          <div className="card p-5">
            <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Create a study reminder</div>
            <p className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>Fires a browser notification at the set time.</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Reminder title</label>
                <input className="input mt-1" placeholder="e.g. Review Cardiology lecture"
                  value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Date &amp; time</label>
                <input className="input mt-1" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
              {saveStatus === "saved" && (
                <p className="text-xs" style={{ color: "var(--c-brand)" }}>✓ Reminder saved</p>
              )}
              {saveStatus === "error" && (
                <p className="text-xs text-rose-500">Fill in title and time</p>
              )}
              {permission !== "granted" && saveStatus === "saved" && (
                <p className="text-xs" style={{ color: "var(--c-text-3)" }}>
                  Notifications are not enabled yet — enable them above so reminders fire on time.
                </p>
              )}
              <button className="btn-primary w-full" onClick={addReminder}>
                <Bell className="h-4 w-4" /> Save reminder
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Saved Reminders ────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="mb-3 text-base font-semibold" style={{ color: "var(--c-text-1)" }}>Saved reminders</div>
        <div className="space-y-2">
          {upcoming.length ? (
            upcoming.map((item) => (
              <div key={item.id}
                className="flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>{item.title}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--c-text-3)" }}>
                    {new Date(item.when).toLocaleString()} · {item.slot}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] ${
                      item.fired
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {item.fired ? "sent" : "scheduled"}
                  </span>
                  <button className="btn-ghost text-xs py-1.5 px-2" onClick={() => removeReminder(item.id)}>
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)", color: "var(--c-text-3)" }}>
              No reminders saved yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--c-elevated)", border: "1px solid var(--c-border)" }}>
      <div className="flex items-center justify-between" style={{ color: "var(--c-text-3)" }}>
        <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>{value}</div>
    </div>
  );
}
