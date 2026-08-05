import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, BookOpenCheck, ChevronRight, FileText, HelpCircle, Layers, PlaySquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSubjectOverviews } from "@/lib/subject-data";
import { getSubjectIconName } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  meta?: { type?: string } | null;
  position?: number;
};

type FlashcardRow = { id: string; front: string; back: string };

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

function isIfomCourse(course: { slug?: string | null; title?: string | null }) {
  const text = `${course.slug || ""} ${course.title || ""}`.toLowerCase();
  return text.includes("ifom") && text.includes("cse");
}

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await createClient();

  const { data: course } = await s
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!course) notFound();

  const ifomCourse = isIfomCourse(course);

  if (ifomCourse) {
    const subjectOverviews = (await getSubjectOverviews("IFOM_CSE"))
      .filter((subject) => subject.videoCount || subject.documentCount || subject.qbankCount || subject.keyPointCount)
      .sort((a, b) => {
        const aTotal = a.videoCount + a.documentCount + a.qbankCount + a.keyPointCount;
        const bTotal = b.videoCount + b.documentCount + b.qbankCount + b.keyPointCount;
        return bTotal - aTotal || a.title.localeCompare(b.title);
      });

    const totals = subjectOverviews.reduce(
      (acc, subject) => {
        acc.subjects += 1;
        acc.videos += subject.videoCount;
        acc.documents += subject.documentCount;
        acc.qbanks += subject.qbankCount;
        acc.flashcards += subject.keyPointCount;
        return acc;
      },
      { subjects: 0, videos: 0, documents: 0, qbanks: 0, flashcards: 0 },
    );

    return (
      <div className="page-shell pb-10">
        <section className="mt-4 overflow-hidden rounded-[32px] border border-ink-800 bg-[radial-gradient(circle_at_top,_rgba(79,140,255,0.22),_rgba(8,15,30,0.97)_55%)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
          <div className="inline-flex items-center rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            <BookOpenCheck className="mr-2 h-4 w-4" /> Darwish IFOM CSE Program
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl">Course subjects mapped exactly like the Q-Bank flow</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Every IFOM subject opens as its own study hub with video sessions, notes documents, active Q-Bank HTML documents, and high-yield flashcard bullets.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <HeroStat value={totals.subjects} label="Subjects" />
            <HeroStat value={totals.videos} label="Video Sessions" />
            <HeroStat value={totals.documents} label="Documents" />
            <HeroStat value={totals.qbanks} label="Q-Bank Blocks" />
            <HeroStat value={totals.flashcards} label="High-Yield Bullets" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/ifom" className="btn-primary">
              <BookOpenCheck className="h-4 w-4" /> Open IFOM realistic exam
            </Link>
            <Link href="/qbank?exam=IFOM_CSE" className="btn-ghost">
              <HelpCircle className="h-4 w-4" /> Open IFOM Q-Bank
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.28em] text-slate-500">Program Subjects</h2>
          </div>

          <div className="space-y-4">
            {subjectOverviews.map((subject) => {
              const Icon = getSubjectIconName(subject.title);
              return (
                <Link
                  key={subject.slug}
                  href={`/subjects/${subject.slug}?exam=IFOM_CSE`}
                  className="group relative block overflow-hidden rounded-[30px] border border-ink-800 bg-[#0c1324] p-6 shadow-[0_12px_40px_rgba(2,6,23,0.36)] transition hover:-translate-y-0.5 hover:border-slate-700"
                >
                  <div className={`absolute inset-y-5 left-0 w-1 rounded-r-full bg-gradient-to-b ${subject.accentBar}`} />
                  <div className="pl-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className={`grid h-16 w-16 place-items-center rounded-[24px] ${subject.iconWrap} ${subject.iconClass}`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${subject.badgeClass} bg-white/[0.03]`}>
                        {subject.qbankCount} active Q-Bank blocks
                      </div>
                    </div>

                    <h3 className="mt-5 text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[2.2rem]">
                      {subject.title}
                    </h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400 sm:text-[15px]">
                      {subject.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <span className="rounded-full border border-ink-700 px-2.5 py-1">{subject.videoCount} video sessions</span>
                      <span className="rounded-full border border-ink-700 px-2.5 py-1">{subject.documentCount} notes documents</span>
                      <span className="rounded-full border border-ink-700 px-2.5 py-1">{subject.qbankCount} qbank html docs</span>
                      <span className="rounded-full border border-ink-700 px-2.5 py-1">{subject.keyPointCount} flashcard bullets</span>
                    </div>

                    <div className={`mt-6 inline-flex items-center gap-2 text-base font-semibold ${subject.actionClass}`}>
                      Open Subject Hub <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const [{ data: subjects }, { data: lessons }] = await Promise.all([
    s.from("subjects").select("id,title,position").eq("course_id", course.id).order("position"),
    s.from("lessons").select("id,title,kind,meta,position").eq("course_id", course.id).eq("visible", true).order("position"),
  ]);

  const allLessons = (lessons ?? []) as LessonRow[];
  const lessonIds = allLessons.map((l) => l.id);

  const [{ count: questionCount }, { data: flashcards }] = await Promise.all([
    lessonIds.length
      ? s.from("questions").select("*", { count: "exact", head: true }).in("lesson_id", lessonIds)
      : Promise.resolve({ count: 0 }),
    lessonIds.length
      ? s.from("flashcards").select("id,front,back").in("lesson_id", lessonIds).limit(6)
      : Promise.resolve({ data: [] as FlashcardRow[] }),
  ]);

  const videoLessons = allLessons.filter((l) => (l.meta as { type?: string } | null)?.type === "video");
  const docLessons = allLessons.filter(
    (l) =>
      (l.kind === "html" || l.kind === "html-file" || l.kind === "html-inline" || l.kind === "pdf") &&
      (l.meta as { type?: string } | null)?.type !== "video",
  );
  const allCards = (flashcards ?? []) as FlashcardRow[];
  const allSubjects = subjects ?? [];

  return (
    <div className="page-shell pb-10">
      <div className="card p-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          <BookOpen className="h-3.5 w-3.5" /> Course
        </div>
        <h1 className="text-3xl font-bold text-white">{course.title}</h1>
        {course.description && <p className="mt-2 text-base leading-7 text-slate-400">{course.description}</p>}
        {allSubjects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {allSubjects.map((sub: { id: string; title: string }) => (
              <span key={sub.id} className="rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs text-slate-300">
                {sub.title}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="mt-6">
        <SectionHeader icon={<PlaySquare className="h-5 w-5" />} title="Video Sessions" count={videoLessons.length} color="text-fuchsia-300" />
        {videoLessons.length === 0 ? (
          <EmptyState label="No video sessions yet" />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {videoLessons.map((l) => (
              <Link key={l.id} href={`/lesson/${l.id}`} className="card flex items-center gap-4 p-4 hover:border-fuchsia-400/40 transition">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fuchsia-400/10 text-fuchsia-300">
                  <PlaySquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">{l.title}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-widest text-slate-500">Video session</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionHeader icon={<FileText className="h-5 w-5" />} title="Notes & Documents" count={docLessons.length} color="text-cyan-300" />
        {docLessons.length === 0 ? (
          <EmptyState label="No documents yet" />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {docLessons.map((l) => (
              <Link key={l.id} href={`/lesson/${l.id}`} className="card flex items-center gap-4 p-4 hover:border-cyan-400/40 transition">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">{l.title}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-widest text-slate-500">Study resource</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <SectionHeader icon={<HelpCircle className="h-5 w-5" />} title="Q-Bank Quiz Block" count={questionCount ?? 0} color="text-amber-300" />
        <div className="mt-3 card p-5">
          {!questionCount ? (
            <p className="text-sm text-slate-500">No questions linked to this course yet.</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{questionCount}</div>
                <div className="text-sm text-slate-400">practice questions available</div>
              </div>
              <Link href={`/qbank/configure?course=${course.id}&returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`} className="btn-primary">
                <HelpCircle className="h-4 w-4" /> Start Quiz
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader icon={<Layers className="h-5 w-5" />} title="Key Points" count={allCards.length} color="text-emerald-300" />
        {allCards.length === 0 ? (
          <EmptyState label="No key points yet" />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {allCards.map((card) => (
              <div key={card.id} className="card p-4 border-emerald-400/10 hover:border-emerald-400/30 transition">
                <div className="text-sm font-semibold text-slate-100 leading-6">{card.front}</div>
                <div className="mt-2 text-xs leading-6 text-slate-400 whitespace-pre-line">{card.back}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[22px] border border-ink-800 bg-[#0b1220]/80 p-4 text-center">
      <div className="text-4xl font-bold text-brand">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={color}>{icon}</div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {count > 0 && <span className="rounded-full bg-ink-800 px-2.5 py-0.5 text-xs text-slate-400">{count}</span>}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="mt-3 rounded-2xl border border-ink-700 bg-ink-900/50 p-5 text-sm text-slate-500">{label}</div>;
}
