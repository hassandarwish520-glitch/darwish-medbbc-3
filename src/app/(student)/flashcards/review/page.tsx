import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReviewRunner from "./ReviewRunner";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson_id?: string }>;
}) {
  const ctx = await requireUser();
  const s = await createClient();
  const today = new Date().toISOString();
  const { lesson_id } = await searchParams;

  // Due reviews
  let dueQuery = s
    .from("flashcard_reviews")
    .select("*, flashcards(*)")
    .eq("user_id", ctx!.user.id)
    .lte("due_at", today)
    .order("due_at")
    .limit(30);

  if (lesson_id) {
    // Join filter: only include reviews whose flashcard belongs to this lesson
    dueQuery = s
      .from("flashcard_reviews")
      .select("*, flashcards!inner(*)")
      .eq("user_id", ctx!.user.id)
      .eq("flashcards.lesson_id", lesson_id)
      .lte("due_at", today)
      .order("due_at")
      .limit(30);
  }

  const { data: due } = await dueQuery;

  // New cards (never reviewed)
  const knownIds = (due ?? []).map((r: any) => r.flashcard_id);
  let freshQuery = s.from("flashcards").select("*").limit(20);
  if (lesson_id) {
    freshQuery = s
      .from("flashcards")
      .select("*")
      .eq("lesson_id", lesson_id)
      .limit(20);
  }
  if (knownIds.length) {
    freshQuery = freshQuery.not(
      "id",
      "in",
      `(${knownIds.join(",")})`,
    ) as typeof freshQuery;
  }
  const { data: fresh } = await freshQuery;

  const queue = [
    ...(due ?? []).map((r: any) => ({ card: r.flashcards, review: r })),
    ...((fresh ?? []).map((c) => ({ card: c, review: null }))),
  ];

  // Get lesson title for the heading
  let lessonTitle: string | null = null;
  if (lesson_id) {
    const { data: lesson } = await s
      .from("lessons")
      .select("title")
      .eq("id", lesson_id)
      .maybeSingle();
    lessonTitle = lesson?.title ?? null;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/flashcards"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Flashcards
      </Link>
      <h1 className="text-2xl font-bold">
        {lessonTitle ? `Review — ${lessonTitle}` : "Review session"}
      </h1>
      <ReviewRunner queue={queue as any} />
    </div>
  );
}
