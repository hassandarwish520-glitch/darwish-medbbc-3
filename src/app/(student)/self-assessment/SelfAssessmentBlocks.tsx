"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  PlusCircle,
  FileText,
  Layers,
  BookOpenCheck,
  Clock,
  ExternalLink,
} from "lucide-react";

export type LessonItem = {
  id: string;
  title: string;
  kind: string;
  meta?: Record<string, unknown> | null;
};

// ── Shared accordion shell ────────────────────────────────────────────────────

type SectionProps = {
  title: string;
  subtitle: string;
  badge?: string;
  accent: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function ExpandableSection({
  title,
  subtitle,
  badge,
  accent,
  icon,
  children,
  defaultOpen = false,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`overflow-hidden rounded-[26px] border border-ink-800 bg-gradient-to-br ${accent}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white">
            {icon}
          </div>
          <div>
            {badge ? (
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {badge}
              </div>
            ) : null}
            <div className="mt-0.5 text-xl font-bold text-white">{title}</div>
            <p className="mt-0.5 text-sm leading-6 text-slate-300">{subtitle}</p>
          </div>
        </div>
        <div
          className="shrink-0 text-slate-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Lesson card (shared between sections) ────────────────────────────────────

function LessonCard({
  lesson,
  accentColor,
}: {
  lesson: LessonItem;
  accentColor: string;
}) {
  const kindLabel: Record<string, string> = {
    pdf: "PDF",
    html: "HTML",
    "html-file": "HTML",
    "html-inline": "HTML",
    qbank: "QBank",
    notes: "Notes",
    video: "Video",
  };
  const label = kindLabel[lesson.kind] ?? lesson.kind.toUpperCase();

  return (
    <Link
      href={`/lesson/${lesson.id}`}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-ink-700 bg-ink-950/60 p-4 transition hover:border-white/20 hover:bg-white/5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${accentColor}`}
        >
          {label}
        </div>
        <span className="truncate font-medium text-white">{lesson.title}</span>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white" />
    </Link>
  );
}

// ── NBME Section ─────────────────────────────────────────────────────────────

export function NbmeSection({ lessons }: { lessons: LessonItem[] }) {
  return (
    <ExpandableSection
      title="NBME Forms"
      badge={lessons.length ? `${lessons.length} form${lessons.length !== 1 ? "s" : ""} available` : "True exam blocks"}
      subtitle="Full NBME self-assessment forms with complete timed review."
      accent="from-violet-500/20 to-fuchsia-500/10"
      icon={<BookOpenCheck className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {lessons.length > 0 ? (
          <>
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                accentColor="bg-violet-500/20 text-violet-300"
              />
            ))}
            <p className="pt-1 text-center text-xs text-slate-500">
              More NBME forms will appear here as they are uploaded.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-violet-400/30 bg-violet-500/5 p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-500/15 text-violet-300">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold text-white">
              NBME exam blocks will appear here
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              When NBME-style forms are uploaded to the platform, each one will
              appear here as a block ready to open.
            </p>
            <ul className="mx-auto mt-4 max-w-xs list-disc space-y-1.5 pl-5 text-left text-sm text-slate-400 marker:text-violet-400">
              <li>NBME-style full forms</li>
              <li>Final review checkpoints</li>
              <li>High-yield error tracking</li>
            </ul>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}

// ── CMS Section ──────────────────────────────────────────────────────────────

export function CmsSection({ lessons }: { lessons: LessonItem[] }) {
  return (
    <ExpandableSection
      title="CMS Forms"
      badge={lessons.length ? `${lessons.length} form${lessons.length !== 1 ? "s" : ""} available` : "Subject-wise forms"}
      subtitle="Subject-specific CMS forms and targeted repeat review passes."
      accent="from-cyan-500/20 to-blue-500/10"
      icon={<Layers className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {lessons.length > 0 ? (
          <>
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                accentColor="bg-cyan-500/20 text-cyan-300"
              />
            ))}
            <p className="pt-1 text-center text-xs text-slate-500">
              More CMS forms will appear here as they are uploaded.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-500/5 p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-500/15 text-cyan-300">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold text-white">
              CMS form blocks will appear here
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Subject-wise CMS sessions will be added as dedicated blocks in
              this section.
            </p>
            <ul className="mx-auto mt-4 max-w-xs list-disc space-y-1.5 pl-5 text-left text-sm text-slate-400 marker:text-cyan-400">
              <li>System-specific CMS sets</li>
              <li>Weak-area remediation</li>
              <li>Repeat wrong-answer cycles</li>
            </ul>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}

// ── General Medicine Section ──────────────────────────────────────────────────

export function GeneralMedicineSection({ lessons }: { lessons: LessonItem[] }) {
  return (
    <ExpandableSection
      title="General Medicine Blocks"
      badge={lessons.length ? `${lessons.length} block${lessons.length !== 1 ? "s" : ""} available` : "Mixed board-style blocks"}
      subtitle="Mixed internal medicine, mock exams, and rapid timed review blocks."
      accent="from-emerald-500/20 to-teal-500/10"
      icon={<FileText className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {lessons.length > 0 ? (
          <>
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                accentColor="bg-emerald-500/20 text-emerald-300"
              />
            ))}
            <p className="pt-1 text-center text-xs text-slate-500">
              More general blocks will appear here as they are uploaded.
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-500/5 p-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="mt-3 font-semibold text-white">
              General medicine blocks will appear here
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Mixed internal medicine and rapid timed blocks will be added as
              exam sessions in this section.
            </p>
            <ul className="mx-auto mt-4 max-w-xs list-disc space-y-1.5 pl-5 text-left text-sm text-slate-400 marker:text-emerald-400">
              <li>Mixed medicine sessions</li>
              <li>Rapid timed blocks</li>
              <li>Mock exam papers</li>
            </ul>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}
