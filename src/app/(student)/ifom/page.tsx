import { createClient } from "@/lib/supabase/server";
import IfomExamRunner from "./IfomExamRunner";
import { normalizeQuestions } from "@/lib/question-normalizer";

export const dynamic = "force-dynamic";

export default async function IfomPage() {
  const s = await createClient();
  const { data: questions } = await s
    .from("questions")
    .select("id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption")
    .contains("tags", ["IFOM CSE"])
    .order("created_at", { ascending: false })
    .limit(200);

  const normalized = normalizeQuestions((questions ?? []) as unknown[]);

  // Shuffle so each IFOM attempt uses a different random draw from the pool
  const shuffled = [...normalized];
  for (let k = shuffled.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
  }

  return (
    <div className="page-shell">
      <IfomExamRunner questions={shuffled as any} />
    </div>
  );
}
