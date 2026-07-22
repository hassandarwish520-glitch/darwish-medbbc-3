"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export default function AIStudioClient({ lessons }: { lessons: { id:string; title:string; kind:string }[] }) {
  const [lesson, setLesson] = useState(lessons[0]?.id ?? "");
  const [mode, setMode] = useState<"questions"|"flashcards"|"index">("questions");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");

  async function run() {
    setBusy(true); setOut("");
    const r = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lesson, mode, count, difficulty }) });
    const j = await r.json();
    setOut(JSON.stringify(j, null, 2));
    setBusy(false);
  }

  return (
    <div className="card p-5 mt-4 max-w-2xl space-y-3">
      <div><label className="label">Lesson</label>
        <select className="input mt-1" value={lesson} onChange={e=>setLesson(e.target.value)}>
          {lessons.map(l => <option key={l.id} value={l.id}>{l.title} ({l.kind})</option>)}
        </select></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label">Mode</label>
          <select className="input mt-1" value={mode} onChange={e=>setMode(e.target.value as any)}>
            <option value="questions">Questions</option>
            <option value="flashcards">Flashcards</option>
            <option value="index">RAG Index</option>
          </select></div>
        <div><label className="label">Count</label>
          <input className="input mt-1" type="number" min={1} max={30} value={count} onChange={e=>setCount(+e.target.value)}/></div>
        <div><label className="label">Difficulty</label>
          <select className="input mt-1" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
            {["foundation","intermediate","advanced","expert"].map(x => <option key={x} value={x}>{x}</option>)}
          </select></div>
      </div>
      <button className="btn-primary" onClick={run} disabled={busy || !lesson}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>} Generate
      </button>
      {out && <pre className="bg-ink-950 border border-ink-700 rounded-xl p-3 text-xs overflow-auto">{out}</pre>}
    </div>
  );
}
