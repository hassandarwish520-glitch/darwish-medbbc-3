import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Layers } from "lucide-react";

export default async function FlashcardsHome() {
  const s = createClient();
  const today = new Date().toISOString();
  const { count: due } = await s.from("flashcard_reviews").select("*", { count:"exact", head:true }).lte("due_at", today);
  const { count: total } = await s.from("flashcards").select("*", { count:"exact", head:true });
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <p className="text-slate-400 text-sm">Spaced repetition powered by the SM-2 algorithm.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <div className="card p-5">
          <div className="text-xs text-slate-400">Due today</div>
          <div className="text-4xl font-bold mt-1">{due ?? 0}</div>
          <Link href="/flashcards/review" className="btn-primary mt-3">Start Review Session</Link>
        </div>
        <div className="card p-5">
          <div className="text-xs text-slate-400">Total cards</div>
          <div className="text-4xl font-bold mt-1">{total ?? 0}</div>
          <div className="mt-3 flex items-center text-sm text-slate-400"><Layers className="h-4 w-4 mr-1"/> in your library</div>
        </div>
      </div>
    </div>
  );
}
