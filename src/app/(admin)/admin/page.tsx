import { createAdminClient } from "@/lib/supabase/server";
import StudentsTable from "./StudentsTable";

type StudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  role: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  email_confirmed_at?: string | null;
};

type AttemptRow = { user_id: string; correct: boolean; created_at: string };
type FlashSessionRow = { user_id: string; total: number | null; xp: number | null; duration_seconds: number | null; started_at: string | null };
type ActivityRow = { user_id: string; activity_type: string; lesson_id: string | null; metadata: Record<string, unknown> | null; created_at: string };
type ExamSettingRow = { user_id: string; exam_date: string | null; reminder_slot: string | null; updated_at: string | null };
type LessonRow = { id: string; title: string };

type StudentMetric = {
  id: string;
  name: string;
  email: string;
  attempts: number;
  accuracy: number;
  attempts7d: number;
  activeDays30: number;
  flashcards: number;
  xp: number;
  level: string;
  effectiveness: string;
  lastSeenAt: string | null;
  examDate: string | null;
  daysLeft: number | null;
  lastPdfViewAt: string | null;
  blockedDownloadAttempts: number;
};

function inferRole(email: string | null | undefined, metaRole: unknown, fallbackRole: string | null | undefined) {
  if (fallbackRole) return fallbackRole;
  if (email === "hassandarwish520@gmail.com") return "admin";
  const raw = typeof metaRole === "string" ? metaRole.toLowerCase().trim() : "";
  if (raw === "educator" || raw === "instructor") return "educator";
  if (raw === "admin") return "admin";
  return "student";
}

function startOfUtcDay(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysUntil(dateText: string | null) {
  if (!dateText) return null;
  const target = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - startOfUtcDay()) / 86400000);
}

function studyLevel(attempts: number, accuracy: number, activeDays30: number, xp: number) {
  const score = attempts + Math.round(accuracy * 1.5) + activeDays30 * 8 + Math.round(xp / 3);
  if (score >= 420) return "Elite";
  if (score >= 280) return "Advanced";
  if (score >= 160) return "Committed";
  if (score >= 60) return "Developing";
  return "Starter";
}

function effectivenessLabel(attempts7d: number, activeDays30: number, accuracy: number) {
  if (attempts7d >= 80 || (activeDays30 >= 12 && accuracy >= 75)) return "Very high";
  if (attempts7d >= 30 || (activeDays30 >= 7 && accuracy >= 65)) return "High";
  if (attempts7d >= 10 || activeDays30 >= 3) return "Medium";
  return "Low";
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default async function AdminStudents() {
  const admin = createAdminClient();
  const [profilesRes, authUsersRes, attemptsRes, flashSessionsRes, activityRes, examSettingsRes] = await Promise.all([
    admin.from("profiles").select("id,email,full_name,institution,role,status,created_at,activated_at").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("question_attempts").select("user_id,correct,created_at").order("created_at", { ascending: false }).limit(10000),
    admin.from("flashcard_sessions").select("user_id,total,xp,duration_seconds,started_at").order("started_at", { ascending: false }).limit(5000),
    admin.from("student_activity_logs").select("user_id,activity_type,lesson_id,metadata,created_at").order("created_at", { ascending: false }).limit(2000),
    admin.from("student_exam_settings").select("user_id,exam_date,reminder_slot,updated_at").order("updated_at", { ascending: false }).limit(1000),
  ]);

  const students = profilesRes.data ?? [];
  const authUsers = authUsersRes.data?.users ?? [];
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  const flashSessions = (flashSessionsRes.data ?? []) as FlashSessionRow[];
  const activities = (activityRes.data ?? []) as ActivityRow[];
  const examSettings = (examSettingsRes.data ?? []) as ExamSettingRow[];

  const lessonIds = Array.from(new Set(activities.map((row) => row.lesson_id).filter((v): v is string => typeof v === "string" && v.length > 0)));
  const lessonMap = new Map<string, string>();
  if (lessonIds.length) {
    const { data: lessons } = await admin.from("lessons").select("id,title").in("id", lessonIds.slice(0, 500));
    (lessons ?? []).forEach((row: LessonRow) => lessonMap.set(row.id, row.title));
  }

  const profileMap = new Map((students ?? []).map((row) => [row.id, row]));
  const rows: StudentRow[] = (authUsers ?? []).map((user) => {
    const profile = profileMap.get(user.id);
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return {
      id: user.id,
      email: profile?.email ?? user.email ?? "—",
      full_name: profile?.full_name ?? (typeof meta.full_name === "string" ? meta.full_name : null),
      institution: profile?.institution ?? (typeof meta.institution === "string" ? meta.institution : null),
      role: inferRole(user.email, meta.role, profile?.role),
      status: profile?.status ?? (user.email === "hassandarwish520@gmail.com" ? "active" : "pending"),
      created_at: profile?.created_at ?? user.created_at ?? new Date().toISOString(),
      activated_at: profile?.activated_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? user.confirmed_at ?? null,
    };
  });

  const missingOnlyProfiles = (students ?? []).filter((row) => !(authUsers ?? []).some((user) => user.id === row.id)).map((row) => ({
    ...row,
    email_confirmed_at: null,
  }));

  const allRows = [...rows, ...missingOnlyProfiles];
  const attemptsByUser = new Map<string, AttemptRow[]>();
  attempts.forEach((row) => {
    const list = attemptsByUser.get(row.user_id) ?? [];
    list.push(row);
    attemptsByUser.set(row.user_id, list);
  });
  const flashByUser = new Map<string, FlashSessionRow[]>();
  flashSessions.forEach((row) => {
    const list = flashByUser.get(row.user_id) ?? [];
    list.push(row);
    flashByUser.set(row.user_id, list);
  });
  const activityByUser = new Map<string, ActivityRow[]>();
  activities.forEach((row) => {
    const list = activityByUser.get(row.user_id) ?? [];
    list.push(row);
    activityByUser.set(row.user_id, list);
  });
  const examByUser = new Map(examSettings.map((row) => [row.user_id, row]));

  const now = startOfUtcDay();
  const sevenDaysAgo = now - (7 * 86400000);
  const thirtyDaysAgo = now - (30 * 86400000);

  const metrics: StudentMetric[] = allRows
    .filter((row) => row.role !== "admin")
    .map((row) => {
      const userAttempts = attemptsByUser.get(row.id) ?? [];
      const userFlash = flashByUser.get(row.id) ?? [];
      const userActivity = activityByUser.get(row.id) ?? [];
      const exam = examByUser.get(row.id) ?? null;
      const correct = userAttempts.filter((item) => item.correct).length;
      const attempts7d = userAttempts.filter((item) => new Date(item.created_at).getTime() >= sevenDaysAgo).length;
      const activeDays = new Set<string>();
      userAttempts.forEach((item) => {
        const t = new Date(item.created_at).getTime();
        if (t >= thirtyDaysAgo) activeDays.add(item.created_at.slice(0, 10));
      });
      userActivity.forEach((item) => {
        const t = new Date(item.created_at).getTime();
        if (t >= thirtyDaysAgo) activeDays.add(item.created_at.slice(0, 10));
      });
      const flashcards = userFlash.reduce((sum, item) => sum + (item.total ?? 0), 0);
      const xp = userFlash.reduce((sum, item) => sum + (item.xp ?? 0), 0);
      const combinedTimes = [
        ...userAttempts.map((item) => item.created_at),
        ...userFlash.map((item) => item.started_at ?? ""),
        ...userActivity.map((item) => item.created_at),
      ].filter(Boolean).sort().reverse();
      const lastPdfViewAt = (userActivity.find((item) => item.activity_type === "pdf_view") ?? null)?.created_at ?? null;
      const blockedDownloadAttempts = userActivity.filter((item) => item.activity_type === "pdf_download_blocked").length;
      const accuracy = userAttempts.length ? Math.round((correct / userAttempts.length) * 100) : 0;
      const activeDays30 = activeDays.size;
      return {
        id: row.id,
        name: row.full_name || row.email,
        email: row.email,
        attempts: userAttempts.length,
        accuracy,
        attempts7d,
        activeDays30,
        flashcards,
        xp,
        level: studyLevel(userAttempts.length, accuracy, activeDays30, xp),
        effectiveness: effectivenessLabel(attempts7d, activeDays30, accuracy),
        lastSeenAt: combinedTimes[0] ?? null,
        examDate: exam?.exam_date ?? null,
        daysLeft: daysUntil(exam?.exam_date ?? null),
        lastPdfViewAt,
        blockedDownloadAttempts,
      };
    })
    .sort((a, b) => {
      if (a.blockedDownloadAttempts !== b.blockedDownloadAttempts) return b.blockedDownloadAttempts - a.blockedDownloadAttempts;
      if (a.attempts7d !== b.attempts7d) return b.attempts7d - a.attempts7d;
      return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
    });

  const examAlerts = metrics
    .filter((row) => row.examDate && row.daysLeft !== null && row.daysLeft >= 0)
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .slice(0, 12);

  const recentProtectedEvents = activities
    .filter((row) => row.activity_type === "pdf_download_blocked" || row.activity_type === "pdf_view" || row.activity_type === "exam_date_saved")
    .slice(0, 20)
    .map((row) => {
      const profile = allRows.find((item) => item.id === row.user_id);
      return {
        id: `${row.user_id}-${row.created_at}`,
        user: profile?.full_name || profile?.email || row.user_id,
        email: profile?.email || "—",
        action: row.activity_type,
        lesson: row.lesson_id ? (lessonMap.get(row.lesson_id) ?? row.lesson_id) : (typeof row.metadata?.exam_date === "string" ? `IFOM exam: ${row.metadata.exam_date}` : "—"),
        at: row.created_at,
      };
    });

  const totals = {
    students: metrics.length,
    activeThisWeek: metrics.filter((row) => row.attempts7d > 0 || row.lastSeenAt).length,
    blockedDownloads: metrics.reduce((sum, row) => sum + row.blockedDownloadAttempts, 0),
    examsSoon: examAlerts.filter((row) => (row.daysLeft ?? 9999) <= 14).length,
  };

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Control Center</h1>
        <p className="text-slate-400 text-sm">Real student activity, protected PDF audit trail, IFOM exam dates, and account control in one page.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4"><div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tracked students</div><div className="mt-2 text-3xl font-semibold text-white">{totals.students}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active this week</div><div className="mt-2 text-3xl font-semibold text-emerald-300">{totals.activeThisWeek}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-[0.18em] text-slate-400">Blocked PDF download attempts</div><div className="mt-2 text-3xl font-semibold text-amber-300">{totals.blockedDownloads}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-[0.18em] text-slate-400">IFOM exams within 14 days</div><div className="mt-2 text-3xl font-semibold text-cyan-300">{totals.examsSoon}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-ink-800 px-4 py-3">
            <div className="text-sm font-semibold text-white">Student performance and activity</div>
            <div className="text-xs text-slate-400">Level and effectiveness are calculated from real question attempts, recent active days, and flashcard study sessions.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-ink-800 text-left">
                  <th className="p-3">Student</th>
                  <th className="p-3">Level</th>
                  <th className="p-3">Effectiveness</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Accuracy</th>
                  <th className="p-3">7d</th>
                  <th className="p-3">PDF alerts</th>
                  <th className="p-3">Exam</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 25).map((row) => (
                  <tr key={row.id} className="border-b border-ink-800 align-top">
                    <td className="p-3"><div className="font-medium text-white">{row.name}</div><div className="text-xs text-slate-500">{row.email}</div><div className="text-[11px] text-slate-500 mt-1">Last seen: {fmtDateTime(row.lastSeenAt)}</div></td>
                    <td className="p-3"><span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">{row.level}</span></td>
                    <td className="p-3">{row.effectiveness}</td>
                    <td className="p-3">{row.attempts}</td>
                    <td className="p-3">{row.accuracy}%</td>
                    <td className="p-3">{row.attempts7d}</td>
                    <td className="p-3"><div>{row.blockedDownloadAttempts} blocked</div><div className="text-[11px] text-slate-500">Last PDF view: {fmtDateTime(row.lastPdfViewAt)}</div></td>
                    <td className="p-3">{row.examDate ? <><div>{row.examDate}</div><div className="text-[11px] text-slate-500">{row.daysLeft === null ? "—" : row.daysLeft === 0 ? "Today" : `${row.daysLeft} day(s)`}</div></> : <span className="text-slate-500">—</span>}</td>
                  </tr>
                ))}
                {!metrics.length ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">No student analytics yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card overflow-hidden p-0">
            <div className="border-b border-ink-800 px-4 py-3">
              <div className="text-sm font-semibold text-white">Upcoming IFOM exam alerts</div>
              <div className="text-xs text-slate-400">These dates come from what students save in the reminders / exam date screen.</div>
            </div>
            <div className="divide-y divide-ink-800">
              {examAlerts.map((row) => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-cyan-300">{row.examDate}</div>
                      <div className="text-xs text-slate-500">{row.daysLeft === 0 ? "Exam day" : `${row.daysLeft} day(s) left`}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!examAlerts.length ? <div className="px-4 py-8 text-center text-sm text-slate-500">No saved IFOM exam dates yet.</div> : null}
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <div className="border-b border-ink-800 px-4 py-3">
              <div className="text-sm font-semibold text-white">Protected file audit trail</div>
              <div className="text-xs text-slate-400">Shows who viewed protected PDFs and who tried to download them. This becomes accurate from the moment this release is live.</div>
            </div>
            <div className="divide-y divide-ink-800">
              {recentProtectedEvents.map((row) => (
                <div key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{row.user}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">{fmtDateTime(row.at)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-ink-800 px-2 py-1 text-slate-300">{row.action}</span>
                    <span className="text-slate-500">{row.lesson}</span>
                  </div>
                </div>
              ))}
              {!recentProtectedEvents.length ? <div className="px-4 py-8 text-center text-sm text-slate-500">No protected-file activity logged yet.</div> : null}
            </div>
          </section>
        </div>
      </div>

      <StudentsTable initial={allRows} />
    </div>
  );
}
