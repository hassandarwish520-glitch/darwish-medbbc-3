import { createClient, requireUser } from "@/lib/supabase/server";

export default async function Progress() {
  const ctx = await requireUser();
  const s = createClient();
  const { data: attempts } = await s.from("question_attempts")
    .select("correct,created_at,questions(tags,difficulty)")
    .eq("user_id", ctx!.user.id).order("created_at",{ascending:false}).limit(500);

  const total = attempts?.length ?? 0;
  const correct = (attempts ?? []).filter(a => a.correct).length;
  const acc = total ? Math.round((correct/total)*1000)/10 : 0;

  const byTag: Record<string,{c:number;t:number}> = {};
  (attempts ?? []).forEach((a: any) => {
    (a.questions?.tags ?? []).forEach((t: string) => {
      byTag[t] = byTag[t] || { c: 0, t: 0 };
      byTag[t].t++; if (a.correct) byTag[t].c++;
    });
  });
  const rows = Object.entries(byTag).map(([tag,v])=>({tag, ...v, acc: Math.round(v.c/v.t*1000)/10}))
    .sort((a,b)=>a.acc-b.acc);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">My Progress</h1>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <div className="card p-4"><div className="text-xs text-slate-400">Attempts</div><div className="text-3xl font-bold">{total}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-400">Correct</div><div className="text-3xl font-bold">{correct}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-400">Accuracy</div><div className="text-3xl font-bold">{acc}%</div></div>
      </div>

      <h2 className="text-lg font-semibold mt-8">Topics</h2>
      <div className="card mt-3 overflow-hidden">
        {rows.length ? rows.map(r => (
          <div key={r.tag} className="flex items-center gap-3 p-3 border-b border-ink-800">
            <div className="flex-1 truncate">{r.tag}</div>
            <div className="w-40 h-2 rounded-full bg-ink-800">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${r.acc}%` }}/></div>
            <div className="w-16 text-right text-sm">{r.acc}%</div>
          </div>
        )) : <div className="p-6 text-center text-slate-500 text-sm">No data yet. Attempt some questions.</div>}
      </div>
    </div>
  );
}
