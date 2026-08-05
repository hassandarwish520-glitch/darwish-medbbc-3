"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Key, Loader2, Sparkles } from "lucide-react";

type Lesson = { id: string; title: string; kind: string };
type Mode = "questions" | "flashcards" | "index";

type RunState = {
  tone: "idle" | "success" | "error";
  title: string;
  details: string;
};

function describeResult(mode: Mode, payload: Record<string, unknown>) {
  const inserted = typeof payload.inserted === "number" ? payload.inserted : null;
  if (mode === "index") {
    const indexed = typeof payload.indexed === "number" ? payload.indexed : 0;
    return { tone: "success" as const, title: "Search index updated", details: `Indexed ${indexed} new chunk(s).` };
  }
  if (inserted !== null) {
    return { tone: "success" as const, title: "Operation completed", details: `${inserted} item(s) generated successfully.` };
  }
  return { tone: "success" as const, title: "Operation completed", details: JSON.stringify(payload, null, 2) };
}

function explainError(message: string) {
  if (/AI credentials are missing|AI is not configured yet|401|403/i.test(message)) {
    return "External AI is not configured. Add the API key in the settings panel below, then retry.";
  }
  if (/no text extractable/i.test(message)) {
    return "This lesson has no usable indexed text yet. Add transcript / notes / OCR text first, then retry.";
  }
  return message;
}

export default function AIStudioClient({ lessons }: { lessons: Lesson[] }) {
  const [lesson, setLesson] = useState(lessons[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("questions");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<RunState>({ tone: "idle", title: "", details: "" });

  // AI key settings
  const [apiKey, setApiKey] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pickedLesson = useMemo(() => lessons.find((l) => l.id === lesson), [lessons, lesson]);
  const actionLabel = mode === "questions" ? "Generate Questions" : mode === "flashcards" ? "Generate Flashcards" : "Build Search Index";

  async function run() {
    setBusy(true);
    setState({ tone: "idle", title: "", details: "" });
    try {
      const r = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lesson, mode, count, difficulty }),
      });
      const payload = (await r.json()) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Generation failed");
      setState(describeResult(mode, payload));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Generation failed";
      setState({ tone: "error", title: "Operation failed", details: explainError(message) });
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    if (!apiKey.trim()) return;
    setKeySaving(true);
    setKeyMsg(null);
    try {
      const r = await fetch("/api/admin/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to save key");
      setKeyMsg({ ok: true, text: "AI key saved. It will be used for all AI generation requests." });
      setApiKey("");
    } catch (e: unknown) {
      setKeyMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to save key" });
    } finally {
      setKeySaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-6 max-w-2xl">
      {/* ── AI Key Settings ── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-brand" />
          <div className="font-semibold text-white">AI API Key</div>
        </div>
        <p className="text-sm leading-6 text-slate-400">
          Enter your OpenAI (or compatible) API key to enable AI-powered question and flashcard generation.
          The key is stored securely and used only for generation requests on this platform.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="password"
            placeholder="sk-…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={keySaving || !apiKey.trim()}
            onClick={() => void saveKey()}
          >
            {keySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Key"}
          </button>
        </div>
        {keyMsg && (
          <div className={`text-sm flex items-center gap-2 ${keyMsg.ok ? "text-emerald-300" : "text-red-400"}`}>
            {keyMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {keyMsg.text}
          </div>
        )}
        <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-xs text-slate-400">
          Works with local fallback even without an API key — only AI generation features require it.
          You can also set <code className="text-brand">OPENAI_API_KEY</code> in your Vercel environment variables.
        </div>
      </div>

      {/* ── Generation Studio ── */}
      <div className="card p-5 space-y-4">
        <div className="font-semibold text-white">Generate from Document</div>
        <div>
          <label className="label">Lesson</label>
          <select className="input mt-1" value={lesson} onChange={(e) => setLesson(e.target.value)}>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} ({l.kind})
              </option>
            ))}
          </select>
          {pickedLesson && (
            <div className="text-xs text-slate-500 mt-2">Selected: {pickedLesson.title}</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Mode</label>
            <select className="input mt-1" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="questions">Questions</option>
              <option value="flashcards">Flashcards</option>
              <option value="index">Search Index</option>
            </select>
          </div>
          <div>
            <label className="label">Count</label>
            <input
              className="input mt-1"
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value || 5))}
              disabled={mode === "index"}
            />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input mt-1"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={mode !== "questions"}
            >
              {["foundation", "intermediate", "advanced", "expert"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => void run()}
          disabled={busy || !lesson}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}{" "}
          {actionLabel}
        </button>

        {state.tone !== "idle" && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            <div className="font-medium flex items-center gap-2">
              {state.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}{" "}
              {state.title}
            </div>
            <div className="mt-1 whitespace-pre-wrap leading-6">{state.details}</div>
          </div>
        )}
      </div>
    </div>
  );
}
