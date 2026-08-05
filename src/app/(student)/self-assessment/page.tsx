import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  FileText,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { requireActive } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getSubjectOverviews, subjectHref } from "@/lib/subject-data";
import {
  NbmeSection,
  CmsSection,
  GeneralMedicineSection,
  type LessonItem,
} from "./SelfAssessmentBlocks";

export const dynamic = "force-dynamic";

const BOOSTER_SUBJECTS = [
  "Cardiology",
  "Hematology",
  "Endocrine",
  "Rheumatology & Orthopedics",
] as const;

// ── Fetch uploaded assessment documents from the lessons table ───────────────
async function fetchAssessmentLessons(): Promise<{
  nbme: LessonItem[];
  cms: LessonItem[];
  general: LessonItem[];
}> {
  const admin = createAdminClient();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, kind, meta")
    .eq("visible", true)
    .order("position");

  if (!lessons) return { nbme: [], cms: [], general: [] };

  const normalize = (s: string) => s.toLowerCase().trim();

  const nbme: LessonItem[] = [];
  const cms: LessonItem[] = [];
  const general: LessonItem[] = [];
  const seen = new Set<string>();

  for (const lesson of lessons as LessonItem[]) {
    if (seen.has(lesson.id)) continue;
    const titleNorm = normalize(lesson.title);
    const metaSubject =
      typeof lesson.meta?.subject === "string"
        ? normalize(lesson.meta.subject)
        : "";
    const metaSection =
      typeof lesson.meta?.section === "string"
        ? normalize(lesson.meta.section)
        : "";
    const metaCategory =
      typeof lesson.meta?.category === "string"
        ? normalize(lesson.meta.category)
        : "";
    const combined = [titleNorm, metaSubject, metaSection, metaCategory].join(" ");

    const isNbme =
      metaSubject === "nbme" ||
      metaCategory === "nbme" ||
      combined.includes("nbme");
    if (isNbme) {
      nbme.push(lesson);
      seen.add(lesson.id);
      continue;
    }

    const isCms =
      metaSubject === "cms" ||
      metaCategory === "cms" ||
      combined.includes("cms");
    if (isCms) {
      cms.push(lesson);
      seen.add(lesson.id);
      continue;
    }

    const isGeneral =
      metaSubject === "general quizzes" ||
      metaSubject === "general quiz" ||
      metaCategory === "general" ||
      metaSection === "general" ||
      combined.includes("general quizzes") ||
      combined.includes("general quiz") ||
      combined.includes("general") ||
      combined.includes("mock") ||
      combined.includes("quiz");

    if (isGeneral) {
      general.push(lesson);
      seen.add(lesson.id);
    }
  }

  return { nbme, cms, general };
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function SelfAssessmentPage() {
  const ctx = await requireActive();
  if (!ctx) notFound();

  const [subjects, { nbme, cms, general }] = await Promise.all([
    getSubjectOverviews("IFOM_CSE"),
    fetchAssessmentLessons(),
  ]);

  const boosters = subjects.filter((subject) =>
    BOOSTER_SUBJECTS.includes(
      subject.title as (typeof BOOSTER_SUBJECTS)[number],
    ),
  );

  return (
    <div className="page-shell pb-10">
      {/* Header */}
      <section className="rounded-[28px] border border-ink-800 bg-[radial-gradient(circle_at_top,_rgba(79,140,255,0.20),_rgba(11,18,32,0.96)_52%)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          <ClipboardCheck className="h-3.5 w-3.5" /> Self Assessment Hub
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">
          Organized self-assessment, without clutter
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          NBME forms, CMS forms, general medicine blocks, and focused subject
          boosters — all in one place. Each section expands to show your
          uploaded documents.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/ifom" className="btn-primary">
            <BookOpenCheck className="h-4 w-4" /> IFOM full flow
          </Link>
          <Link href="/qbank" className="btn-ghost">
            <ShieldCheck className="h-4 w-4" /> Open QBank library
          </Link>
        </div>
      </section>

      {/* Dynamic assessment blocks — tap to expand */}
      <section className="mt-6 space-y-4">
        <div className="px-1 text-xs uppercase tracking-[0.18em] text-slate-500">
          Tap a section to expand
        </div>
        <NbmeSection lessons={nbme} />
        <CmsSection lessons={cms} />
        <GeneralMedicineSection lessons={general} />
      </section>

      {/* Subject booster blocks */}
      <section className="mt-8 rounded-[28px] border border-ink-800 bg-ink-900/80 p-5">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-brand" />
          <h2 className="text-xl font-semibold text-white">
            Subject booster blocks
          </h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
          The four uploaded subjects are grouped here as focused boosters:
          source documents, active QBank blocks, notes, flashcards, then a
          subject session.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {boosters.map((subject) => (
            <Link
              key={subject.slug}
              href={subjectHref(subject.title, "IFOM_CSE")}
              className="rounded-2xl border border-ink-700 bg-ink-950/60 p-4 transition hover:border-brand/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {subject.title}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {subject.description}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-brand" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div className="rounded-xl border border-ink-700 bg-[#0b1422] px-3 py-2 text-center">
                  <div className="text-lg font-bold text-white">
                    {subject.documentCount}
                  </div>
                  <div>Docs</div>
                </div>
                <div className="rounded-xl border border-ink-700 bg-[#0b1422] px-3 py-2 text-center">
                  <div className="text-lg font-bold text-white">
                    {subject.qbankCount}
                  </div>
                  <div>QBank</div>
                </div>
                <div className="rounded-xl border border-ink-700 bg-[#0b1422] px-3 py-2 text-center">
                  <div className="text-lg font-bold text-white">
                    {subject.keyPointCount}
                  </div>
                  <div>Cards</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Organization guide */}
      <section className="mt-8 rounded-[28px] border border-ink-800 bg-ink-900/80 p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-semibold text-white">
            How this area is organized
          </h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {(
            [
              [
                "1",
                "Document block",
                "Active source HTML/PDF/PPT review blocks live inside each subject hub.",
              ],
              [
                "2",
                "Notes",
                "Clean rapid-review notes sit beside the source documents instead of in duplicate pages.",
              ],
              [
                "3",
                "Flashcards",
                "High-yield pearls are grouped into a fast revision layer for spaced review.",
              ],
              [
                "4",
                "Session",
                "Each subject links straight into a focused QBank session when questions exist.",
              ],
            ] as [string, string, string][]
          ).map(([step, title, body]) => (
            <div
              key={step}
              className="rounded-2xl border border-ink-700 bg-ink-950/60 p-4"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                {step}
              </div>
              <div className="mt-3 font-semibold text-white">{title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
