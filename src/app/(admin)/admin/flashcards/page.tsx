import { createAdminClient } from "@/lib/supabase/server";
import FlashcardsAdmin from "./FlashcardsAdmin";
export default async function AdminFlashcards() {
  const admin = createAdminClient();
  const { data } = await admin.from("flashcards").select("id,front,back,tags,ai_generated,created_at")
    .order("created_at",{ascending:false}).limit(200);
  const { data: lessons } = await admin.from("lessons").select("id,title");
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <p className="text-slate-400 text-sm">{data?.length ?? 0} cards</p>
      <FlashcardsAdmin initial={data ?? []} lessons={lessons ?? []}/>
    </div>
  );
}
