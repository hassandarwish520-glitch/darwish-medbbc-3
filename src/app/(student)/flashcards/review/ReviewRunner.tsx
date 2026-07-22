"use client";
import { useState } from "react";

type Item = { card: { id: string; front: string; back: string }; review: any | null };

export default function ReviewRunner({ queue }: { queue: Item[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);

  if (!queue.length) return <div className="card p-8 text-center text-slate-400 mt-4">No cards due. 🎉</div>;
  if (i >= queue.length) return <div className="card p-8 text-center mt-4">Session complete ✓</div>;

  const item = queue[i];

  async function grade(g: 0|1|2|3|4|5) {
    await fetch("/api/flashcards/review", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ flashcard_id: item.card.id, grade: g }) });
    setFlip(false);
    setI(x => x+1);
  }

  return (
    <div className="mt-4">
      <div className="text-xs text-slate-400 mb-2">{i+1} / {queue.length}</div>
      <div className="card p-8 min-h-[220px] flex items-center justify-center text-center cursor-pointer"
           onClick={()=>setFlip(f=>!f)}>
        <div className="text-lg">{flip ? item.card.back : item.card.front}</div>
      </div>
      {!flip
        ? <button className="btn-primary mt-4 w-full" onClick={()=>setFlip(true)}>Show answer</button>
        : <div className="grid grid-cols-4 gap-2 mt-4">
            <button className="btn-ghost" onClick={()=>grade(0)}>Again</button>
            <button className="btn-ghost" onClick={()=>grade(3)}>Hard</button>
            <button className="btn-ghost" onClick={()=>grade(4)}>Good</button>
            <button className="btn-primary" onClick={()=>grade(5)}>Easy</button>
          </div>}
    </div>
  );
}
