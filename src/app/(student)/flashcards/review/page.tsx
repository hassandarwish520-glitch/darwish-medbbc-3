import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import FlashcardDeckRunner from "@/components/FlashcardDeckRunner";

export const dynamic = "force-dynamic";

const RICH_SELECT = "id, front, back, lesson_id, section, high_yield, clinical_pearl, memory_tip, references, difficulty, image_url, tags, source, topic_id";
const CORE_SELECT = "id, front, back, lesson_id, tags, topic_id";
const DUE_RICH_SELECT = `flashcard_id, flashcards!inner(${RICH_SELECT})`;
const DUE_CORE_SELECT = `flashcard_id, flashcards!inner(${CORE_SELECT})`;

type FlashcardRow = {
  id: string;
  front: string;
  back: string;
  lesson_id: string | null;
  section?: string | null;
  high_yield?: string | null;
  clinical_pearl?: string | null;
  memory_tip?: string | null;
  references?: string[] | null;
  difficulty?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  source?: string | null;
  topic_id?: string | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function normalizeCard(row: FlashcardRow): FlashcardRow {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    lesson_id: row.lesson_id ?? null,
    section: row.section ?? null,
    high_yield: row.high_yield ?? null,
    clinical_pearl: row.clinical_pearl ?? null,
    memory_tip: row.memory_tip ?? null,
    references: Array.isArray(row.references) ? row.references : [],
    difficulty: row.difficulty ?? null,
    image_url: row.image_url ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source ?? null,
    topic_id: row.topic_id ?? null,
  };
}

async function fetchCardsForLesson(s: SupabaseClient, lessonId: string) {
  const rich = await s.from("flashcards").select(RICH_SELECT).eq("lesson_id", lessonId).limit(200);
  if (!rich.error) return (rich.data ?? []).map((row) => normalizeCard(row as FlashcardRow));

  const fallback = await s.from("flashcards").select(CORE_SELECT).eq("lesson_id", lessonId).limit(200);
  return (fallback.data ?? []).map((row) => normalizeCard(row as FlashcardRow));
}

async function fetchStandaloneCards(s: SupabaseClient) {
  const rich = await s.from("flashcards").select(RICH_SELECT).is("lesson_id", null).limit(120);
  if (!rich.error) return (rich.data ?? []).map((row) => normalizeCard(row as FlashcardRow));

  const fallback = await s.from("flashcards").select(CORE_SELECT).is("lesson_id", null).limit(120);
  return (fallback.data ?? []).map((row) => normalizeCard(row as FlashcardRow));
}

async function fetchDueAndNewCards(s: SupabaseClient, userId: string) {
  const today = new Date().toISOString();

  const dueRich = await s
    .from("flashcard_reviews")
    .select(DUE_RICH_SELECT)
    .eq("user_id", userId)
    .lte("due_at", today)
    .order("due_at")
    .limit(200);

  const dueRows = !dueRich.error
    ? dueRich.data
    : (await s
        .from("flashcard_reviews")
        .select(DUE_CORE_SELECT)
        .eq("user_id", userId)
        .lte("due_at", today)
        .order("due_at")
        .limit(200)).data;

  const fromDue = (dueRows ?? [])
    .map((row: { flashcards: FlashcardRow | FlashcardRow[] | null }) => (Array.isArray(row.flashcards) ? row.flashcards[0] : row.flashcards))
    .filter((card): card is FlashcardRow => Boolean(card))
    .map(normalizeCard);

  const known = new Set(fromDue.map((card) => card.id));

  const newRich = await s.from("flashcards").select(RICH_SELECT).limit(120);
  const newRows = !newRich.error
    ? newRich.data
    : (await s.from("flashcards").select(CORE_SELECT).limit(120)).data;

  const fromNew = ((newRows ?? []) as FlashcardRow[])
    .map(normalizeCard)
    .filter((card) => !known.has(card.id));

  return [...fromDue, ...fromNew];
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson_id?: string; scope?: string }>;
}) {
  const ctx = await requireUser();
  const s = await createClient();
  const { lesson_id, scope } = await searchParams;

  let lessonTitle: string | null = null;
  if (lesson_id) {
    const { data: lesson } = await s.from("lessons").select("title").eq("id", lesson_id).maybeSingle();
    lessonTitle = lesson?.title ?? null;
  }

  let cardRows: FlashcardRow[] = [];
  if (scope === "personal") {
    cardRows = await fetchStandaloneCards(s);
  } else if (lesson_id) {
    cardRows = await fetchCardsForLesson(s, lesson_id);
  } else {
    cardRows = await fetchDueAndNewCards(s, ctx!.user.id);
  }

  const courseLabel = !lessonTitle && scope === "personal" ? "Standalone Deck" : lessonTitle ?? "All Due Cards";
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
          section: c.section ?? null,
          high_yield: c.high_yield ?? null,
          clinical_pearl: c.clinical_pearl ?? null,
          memory_tip: c.memory_tip ?? null,
          references: (c.references ?? []) as string[],
          difficulty: c.difficulty ?? null,
          image_url: c.image_url ?? null,
          tags: c.tags ?? [],
          source: c.source ?? null,
          topic_id: c.topic_id ?? null,
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
