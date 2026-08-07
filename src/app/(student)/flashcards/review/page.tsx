import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import FlashcardDeckRunner from "@/components/FlashcardDeckRunner";

export const dynamic = "force-dynamic";

type FlashcardRow = {
  id: string;
  front: string;
  back: string;
  lesson_id: string | null;
  section: string | null;
  high_yield: string | null;
  clinical_pearl: string | null;
  memory_tip: string | null;
  references: string[] | null;
  difficulty: string | null;
  image_url: string | null;
  tags: string[] | null;
  source: string | null;
  topic_id: string | null;
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson_id?: string; scope?: string }>;
}) {
  const ctx = await requireUser();
  const s = await createClient();
  const { lesson_id, scope } = await searchParams;

  // Determine lesson title (if any)
  let lessonTitle: string | null = null;
  if (lesson_id) {
    const { data: lesson } = await s.from("lessons").select("title").eq("id", lesson_id).maybeSingle();
    lessonTitle = lesson?.title ?? null;
  }

  let cardRows: FlashcardRow[] = [];
  if (scope === "personal") {
    const { data } = await s
      .from("flashcards")
      .select("id, front, back, lesson_id, section, high_yield, clinical_pearl, memory_tip, references, difficulty, image_url, tags, source, topic_id")
      .is("lesson_id", null)
      .limit(120);
    cardRows = (data as FlashcardRow[] | null) ?? [];
  } else if (lesson_id) {
    const { data } = await s
      .from("flashcards")
      .select("id, front, back, lesson_id, section, high_yield, clinical_pearl, memory_tip, references, difficulty, image_url, tags, source, topic_id")
      .eq("lesson_id", lesson_id)
      .limit(200);
    cardRows = (data as FlashcardRow[] | null) ?? [];
  } else {
    // Mix of due + new cards up to 200
    const today = new Date().toISOString();
    const { data: due } = await s
      .from("flashcard_reviews")
      .select("flashcard_id, flashcards!inner(id, front, back, lesson_id, section, high_yield, clinical_pearl, memory_tip, references, difficulty, image_url, tags, source, topic_id)")
      .eq("user_id", ctx!.user.id)
      .lte("due_at", today)
      .order("due_at")
      .limit(200);
    const fromDue = (due ?? [])
      .map((row: { flashcards: FlashcardRow | FlashcardRow[] | null }) => (Array.isArray(row.flashcards) ? row.flashcards[0] : row.flashcards))
      .filter((c): c is FlashcardRow => Boolean(c));
    const known = new Set(fromDue.map((c) => c.id));
    const { data: newCards } = await s
      .from("flashcards")
      .select("id, front, back, lesson_id, section, high_yield, clinical_pearl, memory_tip, references, difficulty, image_url, tags, source, topic_id")
      .limit(120);
    const fromNew = ((newCards as FlashcardRow[] | null) ?? []).filter((c) => !known.has(c.id));
    cardRows = [...fromDue, ...fromNew];
  }

  const courseLabel = !lessonTitle && scope === "personal" ? "Personal Deck" : lessonTitle ?? "All Due Cards";
  const isStandalone = scope === "personal";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/flashcards"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Flashcards
        </Link>
        <div className="text-xs text-slate-500">
          {cardRows.length} {cardRows.length === 1 ? "card" : "cards"} ready · {courseLabel}
        </div>
      </div>

      <FlashcardDeckRunner
        cards={cardRows.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          lesson_id: c.lesson_id,
          section: c.section,
          high_yield: c.high_yield,
          clinical_pearl: c.clinical_pearl,
          memory_tip: c.memory_tip,
          references: (c.references ?? []) as string[],
          difficulty: c.difficulty,
          image_url: c.image_url,
          tags: c.tags ?? [],
          source: c.source,
          topic_id: c.topic_id,
        }))}
        lessonTitle={courseLabel}
        isStandalone={isStandalone}
      />

      {cardRows.length === 0 ? (
        <div className="card mt-4 p-6 text-center text-sm text-slate-500">
          <ChevronRight className="mx-auto mb-1 h-5 w-5" /> No flashcards found — import a document or check back later.
        </div>
      ) : null}
    </div>
  );
}
