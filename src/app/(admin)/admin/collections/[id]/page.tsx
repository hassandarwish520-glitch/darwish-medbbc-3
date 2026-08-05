import { notFound } from "next/navigation";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import CollectionsQuestionAdmin from "./CollectionsQuestionAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdmin();
  if (!ctx) notFound();

  const { id } = await params;
  const admin = createAdminClient();

  const { data: lesson, error: lessonError } = await admin
    .from("lessons")
    .select("id, title, course_id, kind")
    .eq("id", id)
    .single();

  if (lessonError || !lesson) notFound();

  const { data: questions } = await admin
    .from("questions")
    .select(
      "id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption, video_url, created_at"
    )
    .eq("lesson_id", id)
    .order("created_at", { ascending: true });

  return (
    <CollectionsQuestionAdmin
      lesson={lesson}
      questions={questions ?? []}
    />
  );
}
