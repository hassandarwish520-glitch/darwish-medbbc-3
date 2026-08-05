"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, ClipboardCheck, Loader2, MessageSquare, Send, X } from "lucide-react";

type Citation = {
  n: number;
  title: string;
  source_label: string;
  lesson_kind?: string | null;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type Mode = "tutor" | "exam";

type Props = {
  variant?: "floating" | "inline";
  lessonTitle?: string;
  lessonContext?: string;
  companionNotes?: string;
  title?: string;
};

const WELCOME = {
  tutor: "Hello — I am your AI Tutor. Ask me about the lesson and I will explain it step by step.",
  exam: "Exam mode is ready. I will coach you like an examiner and test your clinical reasoning.",
};

function QuickActions({ onPick }: { onPick: (text: string) => void }) {
  const prompts = [
    "Explain the core idea of this lesson",
    "What are the highest-yield clinical points?",
    "Quiz me on this lesson in exam style",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button key={prompt} className="btn-ghost text-xs" onClick={() => onPick(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  );
}

export default function AITutor({
  variant = "floating",
  lessonTitle = "",
  lessonContext = "",
  companionNotes = "",
  title = "AI Tutor",
}: Props) {
  const [open, setOpen] = useState(variant === "inline");
  const [mode, setMode] = useState<Mode>("tutor");
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: WELCOME.tutor }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasContext = useMemo(() => Boolean(lessonTitle || lessonContext || companionNotes), [lessonTitle, lessonContext, companionNotes]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1_000_000, behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    setMsgs([{ role: "assistant", content: WELCOME[mode] }]);
  }, [mode]);

  async function send(prefill?: string) {
    const question = (prefill ?? q).trim();
    if (!question || busy) return;

    const history = msgs.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setQ("");
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setBusy(true);

    try {
      const r = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          mode,
          lesson_title: lessonTitle,
          lesson_context: lessonContext,
          companion_notes: companionNotes,
        }),
      });
      const { answer, citations, error } = await r.json();
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: answer || error || "An unexpected error occurred.",
          citations: Array.isArray(citations) ? citations : [],
        },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Request failed";
      setMsgs((m) => [...m, { role: "assistant", content: `Unable to complete the request: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  const shell = (
    <div className={`${variant === "inline" ? "card" : "card shadow-xl"} flex flex-col overflow-hidden ${variant === "inline" ? "min-h-[560px]" : "h-[620px] w-[92vw] sm:w-[440px]"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-slate-500">
            {hasContext ? "Linked to the current lesson context and your notes" : "General conversation about the platform content"}
          </div>
        </div>
        {variant === "floating" && (
          <button onClick={() => setOpen(false)} className="btn-ghost h-9 w-9 rounded-full p-0">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 border-b border-ink-700">
        <button
          className={mode === "tutor" ? "btn-primary text-xs" : "btn-ghost text-xs"}
          onClick={() => setMode("tutor")}
        >
          <Brain className="h-3.5 w-3.5" /> Tutor Mode
        </button>
        <button
          className={mode === "exam" ? "btn-primary text-xs" : "btn-ghost text-xs"}
          onClick={() => setMode("exam")}
        >
          <ClipboardCheck className="h-3.5 w-3.5" /> Exam Mode
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 text-sm">
        <QuickActions onPick={(text) => void send(text)} />
        {msgs.map((m, i) => (
          <div key={i} className={`rounded-2xl p-3 ${m.role === "user" ? "bg-brand/10 ml-6" : "bg-ink-800 mr-6"}`}>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{m.role === "user" ? "You" : "Tutor"}</div>
            <div className="whitespace-pre-wrap leading-6">{m.content}</div>
            {!!m.citations?.length && (
              <div className="mt-3 border-t border-ink-700 pt-2 space-y-1">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Sources</div>
                {m.citations.map((c) => (
                  <div key={`${i}-${c.n}`} className="text-xs text-slate-300">
                    [{c.n}] {c.source_label}: {c.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-ink-700 p-3 flex gap-2">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={mode === "exam" ? "Ask for a question or clinical case…" : "Ask about this lesson…"}
        />
        <button className="btn-primary" disabled={busy} onClick={() => void send()}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  if (variant === "inline") return shell;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-brand text-ink-950 grid place-items-center shadow-lg hover:bg-brand-dark"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
      {open && <div className="fixed bottom-5 right-5 z-50">{shell}</div>}
    </>
  );
}
