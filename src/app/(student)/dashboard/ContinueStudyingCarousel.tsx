"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  PlaySquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  course_id?: string | null;
};

const kindStyles: Record<string, { color: string; bg: string }> = {
  video:        { color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  pdf:          { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  html:         { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "html-file":  { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  "html-inline":{ color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  notes:        { color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  qbank:        { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  default:      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
};

function KindIcon({ kind }: { kind: string }) {
  if (kind === "video")  return <PlaySquare className="h-5 w-5" />;
  if (kind === "qbank")  return <BookOpen   className="h-5 w-5" />;
  return                        <FileText   className="h-5 w-5" />;
}

// Deterministic fake progress so server/client SSR always match
const FAKE_PROGRESS = [64, 40, 20, 80, 15, 55, 72, 38];

export function ContinueStudyingCarousel({ lessons }: { lessons: LessonRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  };

  if (!lessons.length) return null;

  return (
    <div className="relative">
      {/* ◀ button */}
      <button
        onClick={() => scrollBy("left")}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 hidden sm:flex
                   h-8 w-8 items-center justify-center rounded-full border transition hover:scale-110"
        style={{
          background: "var(--c-card)",
          borderColor: "var(--c-border)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      >
        <ChevronLeft className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {lessons.map((lesson, idx) => {
          const styles  = kindStyles[lesson.kind] ?? kindStyles.default;
          const progress = FAKE_PROGRESS[idx % FAKE_PROGRESS.length];
          const isNew    = idx >= lessons.length - 2; // last 2 cards are "New"

          return (
            <Link
              key={lesson.id}
              href={`/lesson/${lesson.id}`}
              className="group flex-shrink-0 rounded-2xl border p-4 flex flex-col gap-3
                         transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              style={{
                width: "210px",
                background: "var(--c-card)",
                borderColor: "var(--c-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {/* Icon */}
              <div
                className="grid h-10 w-10 place-items-center rounded-xl transition group-hover:scale-105"
                style={{ background: styles.bg, color: styles.color }}
              >
                <KindIcon kind={lesson.kind} />
              </div>

              {/* Kind badge */}
              <span
                className="self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: styles.bg, color: styles.color }}
              >
                {lesson.kind === "html-file" || lesson.kind === "html-inline" ? "HTML" : lesson.kind}
              </span>

              {/* Title */}
              <div
                className="text-sm font-semibold leading-snug line-clamp-2"
                style={{ color: "var(--c-text-1)" }}
              >
                {lesson.title}
              </div>

              {/* Progress or New badge */}
              {isNew ? (
                <span
                  className="text-[11px] font-bold"
                  style={{ color: styles.color }}
                >
                  ✦ New
                </span>
              ) : (
                <div>
                  <div
                    className="flex justify-between text-[11px] mb-1.5"
                    style={{ color: "var(--c-text-4)" }}
                  >
                    <span>{progress}% complete</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--c-elevated)" }}
                  >
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${progress}%`, background: styles.color }}
                    />
                  </div>
                </div>
              )}

              {/* CTA */}
              <div
                className="mt-auto flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: styles.color }}
              >
                {isNew ? "Start" : "Continue"}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ▶ button */}
      <button
        onClick={() => scrollBy("right")}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 hidden sm:flex
                   h-8 w-8 items-center justify-center rounded-full border transition hover:scale-110"
        style={{
          background: "var(--c-card)",
          borderColor: "var(--c-border)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      >
        <ChevronRight className="h-4 w-4" style={{ color: "var(--c-text-2)" }} />
      </button>
    </div>
  );
}
