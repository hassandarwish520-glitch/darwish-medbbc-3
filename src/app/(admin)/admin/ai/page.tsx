import { createAdminClient } from "@/lib/supabase/server";
import AIStudioClient from "./AIStudioClient";

export const dynamic = "force-dynamic";

export default async function AIStudio() {
  const admin = createAdminClient();
  const { data: lessons } = await admin.from("lessons").select("id,title,kind").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">AI Studio</h1>
      <p className="text-slate-400 text-sm">Generate questions, flashcards, and RAG embeddings with clearer runtime feedback.</p>
      <AIStudioClient lessons={lessons ?? []} />
    </div>
  );
}
