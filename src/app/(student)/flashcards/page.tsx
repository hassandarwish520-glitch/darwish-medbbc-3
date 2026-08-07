import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  BookOpen,
  Bookmark as BookmarkIcon,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Upload,
} from "lucide-react";
import FlashcardsImporter from "./FlashcardsImporter";

export const dynamic = "force-dynamic";

type LessonRef = {
  id: string;
  title: string;
  course_title: string | null;
  course_id: string | null;
  count: number;
};

type CourseGroup = {
  course_id: string | null;
  course_title: string;
  lessons: LessonRef[];
  total: number;
};

export default async function FlashcardsHome() {
  const s = await createClient();
  const today = new Date().toISOString();

  const [
    { count: due },
    { count: total },
    { data: allCards },
    { data: lessonsWithCourse },
  ] = await Promise.all([
    s.from("flashcard_reviews")
      .select("*", { count: "exact", head: true })
      .lte("due_at", today),
    s.from("flashcards").select("*", { count: "exact", head: true }),
    s.from("flashcards")
      .select("id, lesson_id")
      .not("lesson_id", "is", null),
    s.from("lessons")
      .select("id, title, course_id, courses(id, title)")
      .order("position", { ascending: true }),
  ]);

  const lessonInfo = new Map<
    string,
    { title: string; course_id: string | null; course_title: string | null }
  >();
  for (const l of (lessonsWithCourse as unknown as Array<{ id: string; title: string; courses: { id: string; title: string } | { id: string; title: string }[] | null }> | null) ?? []) {
    const raw = l.courses as unknown as { id: string; title: string } | { id: string; title: string }[] | null;
    const course = Array.isArray(raw) ? raw[0] ?? null : raw;
    lessonInfo.set(l.id, {
      title: l.title,
      course_id: course?.id ?? null,
      course_title: course?.title ?? null,
    });
  }

  const perLesson = new Map<string, number>();
  for (const fc of allCards ?? []) {
    if (!fc.lesson_id) continue;
    perLesson.set(fc.lesson_id, (perLesson.get(fc.lesson_id) ?? 0) + 1);
  }

  const courseMap = new Map<string, CourseGroup>();
  for (const [lessonId, count] of perLesson) {
    const info = lessonInfo.get(lessonId);
    if (!info) continue;
    const key = info.course_id ?? "__uncategorised__";
    const courseTitle = info.course_title ?? "General";
    let bucket = courseMap.get(key);
    if (!bucket) {
      bucket = {
        course_id: info.course_id,
        course_title: courseTitle,
        lessons: [],
        total: 0,
      };
      courseMap.set(key, bucket);
    }
    bucket.lessons.push({
      id: lessonId,
      title: info.title,
      course_title: info.course_title,
      course_id: info.course_id,
      count,
    });
    bucket.total += count;
  }

  const courseGroups = Array.from(courseMap.values())
    .map((g) => ({ ...g, lessons: g.lessons.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.total - a.total);

  const orphanCount = (allCards ?? []).filter((fc) => !fc.lesson_id).length;

  const totalSubjects = courseGroups.reduce((n, g) => n + g.lessons.length, 0);

  /* Personal state */
  const { data: personalState } = await s
    .from("flashcard_state")
    .select("bookmarked, incorrect_count, streak_correct");
  const bookmarkedCount = (personalState ?? []).filter((r) => r.bookmarked).length;
  const masteredCount = (personalState ?? []).filter((r) => (r.streak_correct ?? 0) >= 3).length;

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title text-3xl">Flashcards</h1>
          <p className="mt-2 text-base leading-7" style={{ color: "var(--c-text-3)" }}>
            Active Recall + Spaced Repetition — extracted directly from your uploaded study material.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/flashcards/review" className="btn-primary inline-flex items-center gap-2 px-4 py-2">
            <Sparkles className="h-4 w-4" /> Review Due Cards
          </Link>
          <Link
            href="/flashcards/review?scope=all"
            className="btn-ghost inline-flex items-center gap-2 px-4 py-2"
          >
            <Layers className="h-4 w-4" /> Study All
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Due today", value: due ?? 0, tone: "rose", icon: Clock },
          { label: "Total cards", value: total ?? 0, tone: "blue", icon: Target },
          { label: "Mastered", value: masteredCount, tone: "emerald", icon: TrendingUp },
          { label: "Bookmarked", value: bookmarkedCount, tone: "amber", icon: BookmarkIcon },
          { label: "Subjects", value: totalSubjects, tone: "violet", icon: Layers },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-3 px-4 py-3" style={{ background: "var(--c-card)" }}>
              <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-2xl font-semibold" style={{ color: "var(--c-text-1)" }}>{stat.value}</div>
                <div className="text-xs" style={{ color: "var(--c-text-3)" }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <FlashcardsImporter />
      </div>

      {courseGroups.length > 0 || orphanCount > 0 ? (
        <div className="mt-6 space-y-6">
          {courseGroups.map((group) => (
            <div key={group.course_id ?? "uncat"}>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--c-text-2)" }}>
                  {group.course_title}
                </h2>
                <span className="text-xs" style={{ color: "var(--c-text-4)" }}>· {group.total} cards</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {group.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/flashcards/review?lesson_id=${lesson.id}`}
                    className="card flex items-center justify-between p-4 transition hover:-translate-y-0.5"
                    style={{ background: "var(--c-card)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl shrink-0"
                           style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-sm font-medium" style={{ color: "var(--c-text-1)" }}>{lesson.title}</span>
                        <span className="text-xs" style={{ color: "var(--c-text-3)" }}>{lesson.course_title ?? "Deck"} · {lesson.count} cards</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: "var(--c-text-3)" }}>
                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--c-elevated)" }}>Deck</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {orphanCount > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "var(--c-text-4)" }} />
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--c-text-3)" }}>
                  Personal / Standalone
                </h2>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Link href="/flashcards/review?scope=personal"
                      className="card flex items-center justify-between p-4 transition hover:-translate-y-0.5"
                      style={{ background: "var(--c-card)" }}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl shrink-0" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)" }}>
                      <Timer className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium" style={{ color: "var(--c-text-1)" }}>Standalone cards</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "var(--c-text-3)" }}>
                    <span className="text-sm">{orphanCount} cards</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "var(--c-elevated)", color: "var(--c-text-3)" }}>
            <Upload className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold" style={{ color: "var(--c-text-1)" }}>No flashcards yet</h2>
          <p className="mt-3 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
            Upload a real study document (PDF, HTML, TXT or Markdown) below.
            The extractor will pull flashcards directly from the source — no generic AI content, no outlines.
          </p>
        </div>
      )}
    </div>
  );
}
