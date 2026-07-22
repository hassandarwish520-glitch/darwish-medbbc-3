import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import ReviewRunner from "./ReviewRunner";

export default async function ReviewPage() {
  const ctx = await requireUser();
  const s = createClient();
  const today = new Date().toISOString();

  // Due reviews
  const { data: due } = await s.from("flashcard_reviews").select("*, flashcards(*)")
    .eq("user_id", ctx!.user.id).lte("due_at", today).order("due_at").limit(30);

  // New cards (never reviewed) — pick a few
  const knownIds = (due ?? []).map((r: any) => r.flashcard_id);
  let query = s.from("flashcards").select("*").limit(20);
  if (knownIds.length) query = query.not("id", "in", `(${knownIds.join(",")})`);
  const { data: fresh } = await query;

  const queue = [
    ...(due ?? []).map((r: any) => ({ card: r.flashcards, review: r })),
    ...((fresh ?? []).map(c => ({ card: c, review: null }))),
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Review session</h1>
      <ReviewRunner queue={queue as any} />
    </div>
  );
}
