import { requireUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { Flame, BookOpen, TrendingUp, Target, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const ctx = await requireUser();
  const s = createClient();

  const today = new Date().toISOString();
  const [{ count: dueCount }, { data: attempts }, { count: totalQ }] = await Promise.all([
    s.from("flashcard_reviews").select("*", { count: "exact", head: true })
      .eq("user_id", ctx!.user.id).lte("due_at", today),
    s.from("question_attempts").select("correct, created_at").eq("user_id", ctx!.user.id)
      .order("created_at", { ascending: false }).limit(200),
    s.from("questions").select("*", { count: "exact", head: true }),
  ]);
  const correct = (attempts ?? []).filter(a => a.correct).length;
  const accuracy = attempts && attempts.length ? Math.round((correct / attempts.length) * 1000) / 10 : 0;

  const firstName = (ctx?.profile?.full_name || ctx?.profile?.email || "").split(" ")[0];
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <p className="text-xs text-slate-500 tracking-widest">{date}</p>
      <h1 className="text-3xl font-bold mt-1">Good morning, {firstName}</h1>
      <p className="text-slate-400 mt-1">
        You have <span className="text-brand">{dueCount ?? 0} flashcards</span> due to review today.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <Stat icon={<Flame className="h-4 w-4 text-orange-400" />} label="Study streak" value="14 🔥" />
        <Stat icon={<Target className="h-4 w-4 text-brand" />}     label="Today"        value="47 min" />
      </div>

      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">Flashcards Due Today</div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
            {dueCount ?? 0} due
          </span>
        </div>
        <div className="text-5xl font-bold mt-2">{dueCount ?? 0}</div>
        <Link href="/flashcards/review" className="text-brand text-sm mt-3 inline-block">Start Review Session →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400"><TrendingUp className="h-3 w-3" /> Accuracy</div>
          <div className="text-3xl font-bold mt-2">{accuracy}%</div>
          <div className="text-xs text-slate-500 mt-1">{attempts?.length ?? 0} attempts</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400"><BookOpen className="h-3 w-3" /> Question Bank</div>
          <div className="text-3xl font-bold mt-2">{totalQ ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">total questions</div>
        </div>
      </div>

      <div className="card p-5 mt-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm text-slate-300">Weak topics flagged</div>
          <div className="text-xs text-slate-500">Accuracy below 50% threshold on recent attempts.</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">{icon}{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
