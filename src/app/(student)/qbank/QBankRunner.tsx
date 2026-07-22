"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";

type Q = { id: string; stem: string; choices: {key:string;text:string}[]; answer_key: string; explanation: string | null; difficulty: string; tags: string[] };

export default function QBankRunner({ questions }: { questions: Q[] }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [t0] = useState(Date.now());

  if (!questions.length) return <div className="card p-8 text-center text-slate-500 mt-6">No questions yet. Ask an admin to add or AI-generate questions.</div>;
  if (i >= questions.length) return (
    <div className="card p-8 text-center mt-6">
      <div className="text-3xl font-bold">Session complete</div>
      <div className="text-slate-400 mt-2">Score: {correctCount} / {questions.length}</div>
    </div>
  );

  const q = questions[i];

  async function submit() {
    if (!picked) return;
    setRevealed(true);
    const correct = picked === q.answer_key;
    if (correct) setCorrectCount(c => c+1);
    const s = createClient();
    const uid = (await s.auth.getUser()).data.user!.id;
    await s.from("question_attempts").insert({
      user_id: uid, question_id: q.id, chosen: picked, correct, time_ms: Date.now() - t0,
    });
  }
  function next() { setPicked(null); setRevealed(false); setI(x => x+1); }

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Question {i+1} / {questions.length}</span>
        <span className="uppercase">{q.difficulty}</span>
      </div>
      <p className="mt-4 text-lg leading-relaxed">{q.stem}</p>

      <div className="mt-4 space-y-2">
        {q.choices.map(c => {
          const isPicked = picked === c.key;
          const isCorrect = revealed && c.key === q.answer_key;
          const isWrong   = revealed && isPicked && c.key !== q.answer_key;
          return (
            <button key={c.key} onClick={() => !revealed && setPicked(c.key)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                isCorrect ? "border-emerald-500 bg-emerald-500/10" :
                isWrong ? "border-red-500 bg-red-500/10" :
                isPicked ? "border-brand bg-brand/10" :
                "border-ink-700 hover:border-ink-600"
              }`}>
              <span className="font-mono mr-2">{c.key}.</span>{c.text}
            </button>
          );
        })}
      </div>

      {revealed && q.explanation && (
        <div className="mt-4 p-4 rounded-xl bg-ink-800 border border-ink-700">
          <div className="flex items-center gap-2 mb-1 text-sm">
            {picked === q.answer_key
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-400"/> Correct</>
              : <><XCircle className="h-4 w-4 text-red-400"/> Incorrect — answer is {q.answer_key}</>}
          </div>
          <p className="text-sm text-slate-300">{q.explanation}</p>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {!revealed
          ? <button className="btn-primary" disabled={!picked} onClick={submit}>Submit</button>
          : <button className="btn-primary" onClick={next}>Next <ChevronRight className="h-4 w-4"/></button>}
      </div>
    </div>
  );
}
