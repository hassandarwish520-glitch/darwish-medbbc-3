"use client";
import { useState } from "react";
import { Plus, Sparkles, Trash2, HelpCircle } from "lucide-react";

type Q = { id:string; stem:string; difficulty:string; ai_generated:boolean; tags:string[] };

export default function QBankAdmin({ initial, lessons }:{ initial: Q[]; lessons:{id:string;title:string}[] }) {
  const [rows, setRows] = useState<Q[]>(initial);
  const [open, setOpen] = useState<null|"add"|"ai">(null);

  async function remove(id: string) {
    if (!confirm("Delete question?")) return;
    await fetch("/api/admin/questions?id="+id, { method:"DELETE" });
    setRows(rs => rs.filter(r => r.id !== id));
  }

  return (
    <>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={()=>setOpen("add")}><Plus className="h-4 w-4"/> Add Question</button>
        <button className="btn-ghost" onClick={()=>setOpen("ai")}><Sparkles className="h-4 w-4"/> Generate with AI</button>
      </div>

      {!rows.length ? (
        <div className="card p-10 mt-4 text-center">
          <HelpCircle className="h-8 w-8 mx-auto text-slate-500"/>
          <div className="mt-2">No questions yet</div>
          <div className="text-sm text-slate-500">Add your first exam question.</div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map(q => (
            <div key={q.id} className="card p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm line-clamp-2">{q.stem}</div>
                <div className="text-xs text-slate-500 mt-1 flex gap-2">
                  <span className="uppercase">{q.difficulty}</span>
                  {q.ai_generated && <span className="text-brand">AI</span>}
                  {q.tags?.map(t => <span key={t} className="text-slate-500">#{t}</span>)}
                </div>
              </div>
              <button className="btn-ghost text-xs" onClick={()=>remove(q.id)}><Trash2 className="h-3 w-3"/></button>
            </div>
          ))}
        </div>
      )}

      {open === "add" && <AddModal onClose={()=>setOpen(null)} onCreated={(q: Q)=>{ setRows(r=>[q,...r]); setOpen(null); }} lessons={lessons}/>}
      {open === "ai"  && <AIModal  onClose={()=>setOpen(null)} lessons={lessons}/>}
    </>
  );
}

function AddModal({ onClose, onCreated, lessons }: any) {
  const [f, setF] = useState<any>({ lesson_id:"", stem:"", A:"", B:"", C:"", D:"", E:"", answer_key:"A", explanation:"", difficulty:"intermediate", tags:"" });
  const [busy, setBusy] = useState(false);
  const set = (k:string,v:string) => setF({ ...f, [k]: v });
  async function submit() {
    setBusy(true);
    const choices = ["A","B","C","D","E"].filter(k => f[k]).map(k => ({ key:k, text:f[k] }));
    const r = await fetch("/api/admin/questions", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ lesson_id: f.lesson_id || null, stem: f.stem, choices, answer_key: f.answer_key,
        explanation: f.explanation, difficulty: f.difficulty, tags: f.tags.split(",").map((t:string)=>t.trim()).filter(Boolean) }) });
    setBusy(false);
    if (r.ok) { const { question } = await r.json(); onCreated(question); }
  }
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-semibold">Add Question</h3>
        <div className="mt-3 space-y-2">
          <select className="input" value={f.lesson_id} onChange={e=>set("lesson_id",e.target.value)}>
            <option value="">— No lesson —</option>
            {lessons.map((l:any)=><option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <textarea className="input h-24" placeholder="Question stem" value={f.stem} onChange={e=>set("stem",e.target.value)}/>
          {(["A","B","C","D","E"] as const).map(k => (
            <input key={k} className="input" placeholder={`Choice ${k}`} value={f[k]} onChange={e=>set(k, e.target.value)}/>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={f.answer_key} onChange={e=>set("answer_key",e.target.value)}>
              {["A","B","C","D","E"].map(k=><option key={k}>{k}</option>)}
            </select>
            <select className="input" value={f.difficulty} onChange={e=>set("difficulty",e.target.value)}>
              {["foundation","intermediate","advanced","expert"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <textarea className="input h-20" placeholder="Explanation" value={f.explanation} onChange={e=>set("explanation",e.target.value)}/>
          <input className="input" placeholder="Tags (comma separated)" value={f.tags} onChange={e=>set("tags",e.target.value)}/>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}

function AIModal({ onClose, lessons }: any) {
  const [lesson_id, setLesson] = useState(lessons[0]?.id ?? "");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");
  async function run() {
    setBusy(true);
    const r = await fetch("/api/ai/generate", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ lesson_id, mode:"questions", count, difficulty }) });
    const j = await r.json(); setBusy(false); setOut(JSON.stringify(j));
    if (j.inserted) setTimeout(()=>location.reload(), 800);
  }
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-md">
        <h3 className="text-lg font-semibold">AI Generate Questions</h3>
        <div className="mt-3 space-y-2">
          <select className="input" value={lesson_id} onChange={e=>setLesson(e.target.value)}>
            {lessons.map((l:any)=><option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" value={count} onChange={e=>setCount(+e.target.value)}/>
            <select className="input" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              {["foundation","intermediate","advanced","expert"].map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          {out && <p className="text-xs text-slate-400">{out}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={busy||!lesson_id} onClick={run}>Generate</button>
        </div>
      </div>
    </div>
  );
}
