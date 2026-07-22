"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AITutor() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your Darwish MedBBC tutor. Ask me anything from your lessons." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6 }); }, [msgs, open]);

  async function send() {
    if (!q.trim() || busy) return;
    const question = q.trim();
    setQ("");
    setMsgs(m => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const r = await fetch("/api/ai/tutor", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: msgs.slice(-6) }) });
      const { answer, error } = await r.json();
      setMsgs(m => [...m, { role: "assistant", content: answer || error || "…" }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "assistant", content: "Error: " + e.message }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-brand text-ink-950 grid place-items-center shadow-lg hover:bg-brand-dark">
        <MessageSquare className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[400px] h-[560px] card flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-ink-700">
            <div className="font-semibold">AI Tutor</div>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl ${m.role==="user" ? "bg-brand/10 ml-6" : "bg-ink-800 mr-6"}`}>
                <div className="text-xs text-slate-500 mb-1">{m.role}</div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin"/> Thinking…</div>}
          </div>
          <div className="p-3 border-t border-ink-700 flex gap-2">
            <input className="input" value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>e.key==="Enter" && send()} placeholder="Ask a medical question…"/>
            <button className="btn-primary" disabled={busy} onClick={send}><Send className="h-4 w-4"/></button>
          </div>
        </div>
      )}
    </>
  );
}
