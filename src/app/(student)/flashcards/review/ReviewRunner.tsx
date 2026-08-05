"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

type Item = { card: { id: string; front: string; back: string; image_url?: string | null }; review: unknown | null };

export default function ReviewRunner({ queue }: { queue: Item[] }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);

  if (!queue.length)
    return (
      <div className="card p-10 text-center mt-6" style={{ color: "var(--c-text-3)" }}>
        <div className="text-4xl mb-3">🎉</div>
        <div className="text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>All caught up!</div>
        <div className="mt-2 text-sm">No cards are due right now.</div>
      </div>
    );

  if (i >= queue.length)
    return (
      <div className="card p-10 text-center mt-6">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-lg font-semibold" style={{ color: "var(--c-text-1)" }}>Session complete</div>
        <div className="mt-2 text-sm" style={{ color: "var(--c-text-3)" }}>
          You reviewed {queue.length} card{queue.length !== 1 ? "s" : ""}
        </div>
      </div>
    );

  const item = queue[i];
  const hasImage = !!item.card.image_url;

  async function grade(g: 0 | 1 | 2 | 3 | 4 | 5) {
    await fetch("/api/flashcards/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcard_id: item.card.id, grade: g }),
    });
    setFlip(false);
    setI((x) => x + 1);
  }

  const progress = Math.round(((i) / queue.length) * 100);

  return (
    <div className="mt-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-3 text-xs" style={{ color: "var(--c-text-4)" }}>
        <span>{i + 1} / {queue.length}</span>
        <span>{progress}% complete</span>
      </div>
      <div className="h-1.5 rounded-full mb-5" style={{ background: "var(--c-elevated)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--c-brand), var(--c-blue))" }}
        />
      </div>

      {/* Navigation arrows row */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="btn-ghost text-xs py-1.5 px-2 disabled:opacity-30"
          disabled={i === 0}
          onClick={() => { setI((x) => Math.max(0, x - 1)); setFlip(false); }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {queue.slice(0, Math.min(queue.length, 12)).map((_, idx) => (
            <div
              key={idx}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: idx === i ? "20px" : "6px",
                background: idx < i
                  ? "var(--c-brand)"
                  : idx === i
                  ? "var(--c-blue)"
                  : "var(--c-elevated)",
              }}
            />
          ))}
          {queue.length > 12 && <span className="text-[10px] self-center" style={{ color: "var(--c-text-4)" }}>+{queue.length - 12}</span>}
        </div>
        <button
          className="btn-ghost text-xs py-1.5 px-2 disabled:opacity-30"
          disabled={i >= queue.length - 1}
          onClick={() => { setI((x) => Math.min(queue.length - 1, x + 1)); setFlip(false); }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Flashcard — image carousel style */}
      <div
        className="relative cursor-pointer select-none rounded-2xl overflow-hidden"
        onClick={() => setFlip((f) => !f)}
        style={{
          background: "var(--c-card)",
          border: "1px solid var(--c-border)",
          boxShadow: "var(--shadow-elevated)",
          minHeight: hasImage ? "340px" : "220px",
        }}
      >
        {/* Image area */}
        {hasImage && (
          <div className="w-full overflow-hidden" style={{ height: flip ? "0px" : "220px", transition: "height 0.3s ease" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.card.image_url!}
              alt="Flashcard image"
              className="w-full h-full object-cover"
              style={{ display: "block" }}
            />
          </div>
        )}

        {/* Flip hint */}
        {!flip && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest rounded-full px-2 py-1"
            style={{ background: "rgba(0,0,0,0.35)", color: "#fff", backdropFilter: "blur(4px)" }}
          >
            <RotateCcw className="h-3 w-3" /> tap to flip
          </div>
        )}

        {/* Card side badge */}
        <div
          className="absolute top-3 left-3 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: flip ? "var(--c-blue-bg)" : "var(--c-brand-bg)",
            color: flip ? "var(--c-blue)" : "var(--c-brand)",
            border: `1px solid ${flip ? "var(--c-blue-border)" : "var(--c-brand-border)"}`,
          }}
        >
          {flip ? "Answer" : "Question"}
        </div>

        {/* Text content */}
        <div className="p-6 pt-10">
          <div
            className="text-lg font-medium leading-relaxed"
            style={{ color: flip ? "var(--c-text-2)" : "var(--c-text-1)" }}
          >
            {flip ? item.card.back : item.card.front}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!flip ? (
        <button className="btn-primary mt-4 w-full" onClick={() => setFlip(true)}>
          Show Answer
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2 mt-4">
          <button
            className="btn-ghost flex flex-col items-center py-3 text-xs"
            onClick={() => void grade(0)}
            style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}
          >
            <span className="text-base mb-0.5">😰</span>
            Again
          </button>
          <button
            className="btn-ghost flex flex-col items-center py-3 text-xs"
            onClick={() => void grade(3)}
            style={{ borderColor: "rgba(245,158,11,0.3)", color: "#f59e0b" }}
          >
            <span className="text-base mb-0.5">😐</span>
            Hard
          </button>
          <button
            className="btn-ghost flex flex-col items-center py-3 text-xs"
            onClick={() => void grade(4)}
            style={{ borderColor: "var(--c-blue-border)", color: "var(--c-blue)" }}
          >
            <span className="text-base mb-0.5">🙂</span>
            Good
          </button>
          <button
            className="btn-primary flex flex-col items-center py-3 text-xs"
            onClick={() => void grade(5)}
          >
            <span className="text-base mb-0.5">😄</span>
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
