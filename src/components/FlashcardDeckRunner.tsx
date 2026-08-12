"use client";

/**
 * FlashcardDeckRunner — main study deck UI the user described:
 *   • Header (back, deck name, card counter, percentage)
 *   • Top progress bar (Cards Studied / Remaining / Mastered)
 *   • Big front card with "Tap to reveal answer"
 *   • Back side reveals: Answer, High Yield, Clinical Pearl,
 *     Memory Tip, References, Tags (High Yield / NBME / IFOM / USMLE)
 *   • Difficulty buttons: 🔴 Again / 🟠 Hard / 🔵 Good / 🟢 Easy
 *   • Navigation: shuffle, previous/next, jump-to
 *   • Statistics, deck info, quick actions
 *   • Filter chips (new / learning / review / difficult / bookmarked / incorrect / mastered)
 *   • Session settings
 *   • Session summary at end
 *
 *   SRS data is persisted via /api/flashcards/review and /api/flashcards/state.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Bookmark as BookmarkIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flag,
  Flame,
  Hash,
  MoreHorizontal,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Shuffle,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";
import { GRADE_OPTIONS, sm2, type Grade, type SpacedRepetitionState } from "@/lib/flashcard-scheduler";
import { extractFlashcardTitle } from "@/lib/flashcards/structured";
import { structureBackText, type SectionGroup, type StructuredBack } from "@/lib/flashcards/structure";
import { SectionGroupsView, UngroupedBullets } from "@/components/flashcard-card/StructuredCardSections";
import { makeSelfContainedFront, deriveBreadcrumbFromCard } from "@/lib/flashcards/context";

type Reference = string;
type FlashcardSection = {
  id: string;
  front: string;
  back: string;
  section?: string | null;
  high_yield?: string | null;
  clinical_pearl?: string | null;
  memory_tip?: string | null;
  references?: Reference[];
  difficulty?: string | null;
  image_url?: string | null;
  tags?: string[];
  source?: string | null;
  topic_id?: string | null;
  xp_reward?: number | null;
  lesson_id?: string | null;
};

type CardState = {
  bookmarked: boolean;
  incorrect_count: number;
  last_seen_at: string | null;
  streak_correct: number;
};

type InitialSchedule = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  lastGrade: Grade | null;
};

type DeckRunnerProps = {
  cards: FlashcardSection[];
  lessonTitle?: string | null;
  isStandalone?: boolean;
};

type FilterKey = "all" | "new" | "learning" | "review" | "difficult" | "bookmarked" | "incorrect" | "mastered";

const SAMPLE_PRESETS = [
  { key: "high_yield", label: "High Yield", tone: "rose" },
  { key: "nbme",       label: "NBME",       tone: "amber" },
  { key: "ifom",       label: "IFOM",       tone: "sky" },
  { key: "usmle",      label: "USMLE",      tone: "violet" },
];

const TINT_BG: Record<string, string> = {
  rose:   "border-rose-400/40 bg-rose-500/15 text-rose-200",
  amber:  "border-amber-400/40 bg-amber-500/15 text-amber-200",
  sky:    "border-sky-400/40 bg-sky-500/15 text-sky-200",
  violet: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  emerald:"border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  blue:   "border-blue-400/40 bg-blue-500/15 text-blue-200",
  slate:  "border-slate-400/40 bg-slate-500/15 text-slate-200",
};

function formatRelative(value: string) {
  try {
    const ms = new Date(value).getTime() - Date.now();
    const abs = Math.abs(ms);
    const days = Math.round(abs / (1000 * 60 * 60 * 24));
    if (Math.abs(days) < 1) return ms >= 0 ? "today" : "today";
    return ms >= 0 ? `in ${days}d` : `${days}d ago`;
  } catch {
    return "soon";
  }
}

function flashTag(label: string, tone = "slate") {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TINT_BG[tone] ?? TINT_BG.slate}`}>
      {label}
    </span>
  );
}

export default function FlashcardDeckRunner({ cards, lessonTitle, isStandalone }: DeckRunnerProps) {
  const initialCount = cards.length;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(initialCount);
  const [showHints, setShowHints] = useState<boolean>(true);
  const [timer, setTimer] = useState<boolean>(true);
  const [audio, setAudio] = useState<boolean>(true);
  const [difficultOnly, setDifficultOnly] = useState<boolean>(false);
  const [masteredOnly, setMasteredOnly] = useState<boolean>(false);
  const [studyStart, setStudyStart] = useState<number>(Date.now());

  const [index, setIndex] = useState<number>(0);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [flipped, setFlipped] = useState<boolean>(false);
  const cardStartRef = useRef<number>(Date.now());
  const [responseMsById, setResponseMsById] = useState<Record<string, number>>({});
  const [schedulesById, setSchedulesById] = useState<Record<string, InitialSchedule>>(() => {
    const map: Record<string, InitialSchedule> = {};
    for (const c of cards) {
      map[c.id] = { ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: new Date().toISOString(), lastGrade: null };
    }
    return map;
  });
  const [stateById, setStateById] = useState<Record<string, CardState>>(() => {
    const map: Record<string, CardState> = {};
    for (const c of cards) {
      map[c.id] = { bookmarked: false, incorrect_count: 0, last_seen_at: null, streak_correct: 0 };
    }
    return map;
  });
  const [gradesById, setGradesById] = useState<Record<string, Grade>>({});
  const [accuracyCount, setAccuracyCount] = useState<{ right: number; wrong: number }>({ right: 0, wrong: 0 });
  const [streak, setStreak] = useState<number>(0);
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [sessionState, setSessionState] = useState<"running" | "complete">("running");
  const [announce, setAnnounce] = useState<string>("");

  /* Hydrate user state from server */
  useEffect(() => {
    if (!cards.length) return;
    let alive = true;
    fetch(`/api/flashcards/state`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({ states: [] }));
        if (!alive) return;
        const next: Record<string, CardState> = { ...stateById };
        for (const row of (payload.states as Array<{ flashcard_id: string; bookmarked: boolean; incorrect_count: number; last_seen_at: string | null; streak_correct: number }>)) {
          next[row.flashcard_id] = {
            bookmarked: row.bookmarked,
            incorrect_count: row.incorrect_count,
            last_seen_at: row.last_seen_at,
            streak_correct: row.streak_correct,
          };
        }
        setStateById(next);
      })
      .catch(() => { /* ignore */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.map((c) => c.id).join("|")]);

  const taggedCards = useMemo(() => {
    return cards.map((c) => {
      const cardTitle = extractFlashcardTitle(c.tags ?? []);
      const tagList = Array.from(new Set([
        ...(c.tags ?? []).filter((tag) => !tag.toLowerCase().startsWith("title:")),
        ...(cardTitle ? [cardTitle] : []),
        ...(c.section ? [c.section] : []),
        ...(c.high_yield ? ["high_yield"] : []),
        ...(c.source ? [c.source] : []),
      ]));
      return { ...c, cardTitle, normalizedTags: tagList.map((t) => t.toLowerCase()) };
    });
  }, [cards]);

  const filteredCards = useMemo(() => {
    let list = taggedCards;
    if (difficultOnly) list = list.filter((c) => (c.difficulty ?? "").toLowerCase() === "hard");
    if (masteredOnly) list = list.filter((c) => (stateById[c.id]?.streak_correct ?? 0) >= 3);
    if (filter === "new")
      list = list.filter((c) => (schedulesById[c.id]?.repetitions ?? 0) === 0);
    else if (filter === "learning")
      list = list.filter((c) => {
        const s = schedulesById[c.id];
        return s && s.repetitions > 0 && s.repetitions < 3;
      });
    else if (filter === "review")
      list = list.filter((c) => {
        const s = schedulesById[c.id];
        return s && new Date(s.dueAt).getTime() <= Date.now() && s.repetitions >= 3;
      });
    else if (filter === "difficult")
      list = list.filter((c) => (stateById[c.id]?.incorrect_count ?? 0) >= 2);
    else if (filter === "bookmarked")
      list = list.filter((c) => stateById[c.id]?.bookmarked);
    else if (filter === "incorrect")
      list = list.filter((c) => (stateById[c.id]?.incorrect_count ?? 0) > 0);
    else if (filter === "mastered")
      list = list.filter((c) => (stateById[c.id]?.streak_correct ?? 0) >= 3);
    if (search.trim().length > 1) {
      const needle = search.toLowerCase();
      list = list.filter((c) =>
        c.front.toLowerCase().includes(needle) ||
        c.back.toLowerCase().includes(needle) ||
        (c.cardTitle ?? "").toLowerCase().includes(needle) ||
        (c.section ?? "").toLowerCase().includes(needle),
      );
    }
    return list.slice(0, Math.max(1, limit));
  }, [difficultOnly, filter, limit, masteredOnly, schedulesById, search, stateById, taggedCards]);

  const safeIndex = Math.min(Math.max(0, index), Math.max(0, filteredCards.length - 1));
  const card = filteredCards[safeIndex];
  const total = filteredCards.length;
  const masteredCount = filteredCards.filter((c) => (stateById[c.id]?.streak_correct ?? 0) >= 3).length;
  const studiedCount = Object.keys(gradesById).length;
  const remainingCount = Math.max(0, total - studiedCount);
  const accuracy = studiedCount === 0 ? 0 : Math.round((accuracyCount.right / studiedCount) * 100);
  const deckTitle = lessonTitle ?? "Personal Deck";
  const currentSectionCards = card?.section ? filteredCards.filter((item) => item.section === card.section) : [];
  const currentSectionIndex = card?.section ? currentSectionCards.findIndex((item) => item.id === card.id) + 1 : 0;

  /* Run timers */
  useEffect(() => {
    cardStartRef.current = Date.now();
    setFlipped(false);
    setRevealed(false);
  }, [safeIndex]);

  const handleFlip = useCallback(() => {
    setFlipped((v) => !v);
    setRevealed(true);
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (sessionState !== "running" || !card) return;
      if (e.code === "Space") { e.preventDefault(); handleFlip(); return; }
      if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
        const map: Record<string, Grade> = { Digit1: 0, Digit2: 2, Digit3: 4, Digit4: 5 };
        grade(map[e.code]);
        return;
      }
      if (e.code === "ArrowLeft") { setIndex((v) => Math.max(0, v - 1)); return; }
      if (e.code === "ArrowRight") { setIndex((v) => Math.min(total - 1, v + 1)); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, handleFlip, sessionState, total]);

  async function grade(g: Grade) {
    if (!card) return;
    const responseMs = Date.now() - cardStartRef.current;
    setResponseMsById((m) => ({ ...m, [card.id]: responseMs }));

    const previous = schedulesById[card.id] ?? { ease: 2.5, intervalDays: 0, repetitions: 0 };
    const next: SpacedRepetitionState = sm2(previous, g);
    setSchedulesById((m) => ({ ...m, [card.id]: { ...next } }));

    const prevState = stateById[card.id] ?? { bookmarked: false, incorrect_count: 0, last_seen_at: null, streak_correct: 0 };
    const nextState: CardState = {
      bookmarked: prevState.bookmarked,
      incorrect_count: g < 3 ? prevState.incorrect_count + 1 : prevState.incorrect_count,
      last_seen_at: new Date().toISOString(),
      streak_correct: g < 3 ? 0 : prevState.streak_correct + 1,
    };
    setStateById((m) => ({ ...m, [card.id]: nextState }));

    setGradesById((m) => ({ ...m, [card.id]: g }));
    setAccuracyCount((c) => g < 3 ? { wrong: c.wrong + 1, right: c.right } : { wrong: c.wrong, right: c.right + 1 });
    setStreak((s) => g < 3 ? 0 : s + 1);
    setXpEarned((x) => x + (g >= 4 ? (g === 5 ? 10 : 5) : 2));
    if (audio) setAnnounce(`Scheduled ${GRADE_OPTIONS.find(o => o.value === g)?.label ?? "Done"}`);

    // Persist
    fetch("/api/flashcards/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcard_id: card.id, grade: g }),
    }).catch(() => { /* ignore network errors in offline mode */ });

    fetch("/api/flashcards/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flashcard_id: card.id,
        incorrect_count: nextState.incorrect_count,
        streak_correct: nextState.streak_correct,
        last_seen_at: nextState.last_seen_at,
      }),
    }).catch(() => { /* noop */ });

    if (safeIndex + 1 >= filteredCards.length) {
      setSessionState("complete");
      try {
        await fetch("/api/flashcards/session-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            started_at: new Date(studyStart).toISOString(),
            ended_at: new Date().toISOString(),
            again: Object.values(gradesById).filter((v) => v < 3).length + (g < 3 ? 1 : 0),
            hard: Object.values(gradesById).filter((v) => v === 2 || v === 3).length + (g === 2 || g === 3 ? 1 : 0),
            good: Object.values(gradesById).filter((v) => v === 4).length + (g === 4 ? 1 : 0),
            easy: Object.values(gradesById).filter((v) => v === 5).length + (g === 5 ? 1 : 0),
            total: studiedCount + 1,
            xp: xpEarned + (g >= 4 ? (g === 5 ? 10 : 5) : 2),
            duration_seconds: Math.round((Date.now() - studyStart) / 1000),
          }),
        });
      } catch { /* ignore */ }
    } else {
      setIndex((v) => v + 1);
    }
  }

  function shuffleDeck() {
    if (!filteredCards.length) return;
    const order = [...Array.from({ length: filteredCards.length }).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setIndex(order[0]);
  }

  function toggleBookmark() {
    if (!card) return;
    setStateById((m) => ({ ...m, [card.id]: { ...m[card.id], bookmarked: !m[card.id].bookmarked } }));
    fetch("/api/flashcards/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flashcard_id: card.id,
        bookmarked: !stateById[card.id]?.bookmarked,
        incorrect_count: stateById[card.id]?.incorrect_count ?? 0,
        streak_correct: stateById[card.id]?.streak_correct ?? 0,
        last_seen_at: new Date().toISOString(),
      }),
    }).catch(() => { /* noop */ });
  }

  function resetSession() {
    setIndex(0);
    setRevealed(false);
    setFlipped(false);
    setStreak(0);
    setSessionState("running");
    setGradesById({});
    setAccuracyCount({ right: 0, wrong: 0 });
    setResponseMsById({});
    setXpEarned(0);
    setStudyStart(Date.now());
  }

  if (!cards.length) {
    return (
      <div className="rounded-[28px] border border-white/15 bg-slate-950/90 p-12 text-center">
        <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-500/15 text-slate-300">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="text-lg font-semibold text-white">No flashcards in this deck yet</div>
        <div className="mt-2 text-sm text-slate-400">
          Upload a study document (PDF / HTML / TXT) and the extractor will turn it into flashcards automatically.
        </div>
        <Link href="/flashcards" className="mt-6 inline-flex rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm text-blue-200">
          Back to Flashcards
        </Link>
      </div>
    );
  }

  if (sessionState === "complete") {
    return (
      <div className="card overflow-hidden rounded-[28px] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-slate-950 to-slate-950">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Session Summary</div>
          <div className="mt-1 text-2xl font-semibold text-white">{deckTitle}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 px-6 py-5 md:grid-cols-4">
          {[
            { label: "Cards Reviewed", value: studiedCount, tone: "blue" },
            { label: "Correct Recall", value: accuracyCount.right, tone: "emerald" },
            { label: "Accuracy", value: `${accuracy}%`, tone: "violet" },
            { label: "Study Time", value: `${Math.round((Date.now() - studyStart) / 1000)}s`, tone: "amber" },
            { label: "XP Earned", value: xpEarned, tone: "rose" },
            { label: "Mastered", value: masteredCount, tone: "emerald" },
            { label: "Streak Best", value: streak, tone: "blue" },
            { label: "Next Review", value: formatRelative(Object.values(schedulesById).sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime())[0]?.dueAt ?? new Date(Date.now() + 86400000).toISOString()), tone: "sky" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3 ${TINT_BG[stat.tone] ?? ""}`}>
              <div className="text-[11px] uppercase tracking-[0.16em] opacity-70">{stat.label}</div>
              <div className="mt-1 text-xl font-semibold text-white">{stat.value}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-6 py-4 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {GRADE_OPTIONS.map((opt) => {
                const count = Object.entries(gradesById).filter(([, g]) => {
                  if (opt.value === 0) return g === 0;
                  if (opt.value === 2) return g === 2 || g === 3;
                  if (opt.value === 4) return g === 4;
                  if (opt.value === 5) return g === 5;
                  return false;
                }).length;
                return (
                  <span key={opt.value} className={`rounded-full border px-3 py-1 text-xs ${TINT_BG[opt.tint] ?? TINT_BG.slate}`}>
                    {opt.emoji} {opt.label}: {count}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={resetSession} className="inline-flex items-center gap-1 rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm text-blue-200">
                <RotateCcw className="h-4 w-4" /> Review Again
              </button>
              <Link href="/flashcards" className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
                Finish Session
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="rounded-[28px] border border-white/15 bg-slate-950/90 p-10 text-center">
        <div className="text-lg font-semibold text-white">🎉 All caught up!</div>
        <div className="mt-2 text-sm text-slate-400">No cards are due right now. Come back tomorrow for your next review.</div>
      </div>
    );
  }
  const cardState = stateById[card.id] ?? { bookmarked: false, incorrect_count: 0, last_seen_at: null, streak_correct: 0 };
  const progressPct = total ? Math.round((studiedCount / total) * 100) : 0;

  return (
    <div className="card overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/90 shadow-[0_24px_70px_rgba(3,7,18,0.45)]">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/flashcards" className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <div>
              <div className="text-base font-semibold text-white md:text-lg">{deckTitle}</div>
              <div className="text-xs text-slate-400">
                Deck • {total} {total === 1 ? "card" : "cards"} • {progressPct}% complete
              </div>
              {isStandalone ? (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Hash className="h-3 w-3" /> Personal Deck
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowSettings(true)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10">
              <SettingsIcon className="h-4 w-4" /> Settings
            </button>
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* progress bar */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Studied", value: studiedCount, tone: "blue" },
            { label: "Remaining", value: remainingCount, tone: "amber" },
            { label: "Mastered", value: masteredCount, tone: "emerald" },
          ].map((metric) => (
            <div key={metric.label} className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3 ${TINT_BG[metric.tone] ?? ""}`}>
              <div className="text-[11px] uppercase tracking-[0.16em] opacity-70">{metric.label}</div>
              <div className="mt-1 text-xl font-semibold text-white">{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Today's progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          {([
            ["all", "All", Filter],
            ["new", "New", Sparkles],
            ["learning", "Learning", Target],
            ["review", "Review", CheckCircle2],
            ["difficult", "Difficult", Flag],
            ["bookmarked", "Bookmarked", BookmarkIcon],
            ["incorrect", "Incorrect", X],
            ["mastered", "Mastered", TrendingUp],
          ] as const).map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              onClick={() => setFilter(key as FilterKey)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                filter === key
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards"
                className="rounded-xl border border-white/10 bg-white/5 px-8 py-1.5 text-xs text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIndex(Math.max(0, safeIndex - 1))} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-30" disabled={safeIndex === 0}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button type="button" onClick={() => setIndex(Math.min(total - 1, safeIndex + 1))} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-30" disabled={safeIndex >= total - 1}>
            Next <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={shuffleDeck} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:bg-white/10">
            <Shuffle className="h-4 w-4" /> Shuffle
          </button>
          <button type="button" onClick={() => setIndex(0)} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 hover:bg-white/10">
            Jump to Card 1
          </button>
        </div>
        <div className="hidden text-right md:block">
          {card.section ? <div className="text-[11px] uppercase tracking-[0.16em] text-blue-300">{card.section}</div> : null}
          <div>
            Card {safeIndex + 1} of {total}
            {currentSectionCards.length > 0 ? ` · ${currentSectionIndex} / ${currentSectionCards.length} in this part` : ""}
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="px-5 py-5">
        <div className="relative">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              {card.section ? flashTag(card.section, "blue") : null}
              {card.high_yield ? flashTag("High Yield", "rose") : null}
              {card.source ? flashTag(card.source.toUpperCase(), "violet") : null}
              {card.difficulty ? flashTag(`Difficulty: ${card.difficulty}`, "amber") : null}
              {flashTag(`Streak ${cardState.streak_correct}`, "emerald")}
            </div>
            <div className="flex items-center gap-2">
              {timer ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                  <Clock className="h-3 w-3" /> {Math.round((Date.now() - cardStartRef.current) / 1000)}s
                </span>
              ) : null}
              <button type="button" onClick={toggleBookmark} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] ${cardState.bookmarked ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                {cardState.bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                Bookmark
              </button>
            </div>
          </div>

          {(() => {
            const backStructure: StructuredBack = structureBackText(card.back);
            const frontForDisplay = makeSelfContainedFront({ front: card.front, title: card.cardTitle });
            const breadcrumbParts = deriveBreadcrumbFromCard(card);
            return (
          <div
            role="button"
            tabIndex={0}
            onClick={handleFlip}
            onKeyDown={(e) => { if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); handleFlip(); } }}
            className="relative cursor-pointer select-none rounded-[28px]"
          >
            {/* FRONT */}
            <div
              className={`rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-7 md:px-8 md:py-8 shadow-[0_24px_60px_rgba(15,23,42,0.55)] transition-transform duration-500 [transform-style:preserve-3d] ${
                flipped ? "[transform:rotateY(180deg)] [backface-visibility:hidden] hidden" : "block"
              }`}
            >
              {card.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={card.image_url} alt="" className="mx-auto mb-4 max-h-32 rounded-2xl border border-white/10 object-contain" />
              ) : null}
              <div className="flex flex-col text-left">
                {breadcrumbParts.length > 0 ? (
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-300/80">
                    {breadcrumbParts.join("  ›  ")}
                  </div>
                ) : null}
                <div className="mt-2 text-2xl font-bold leading-tight text-white md:text-[28px]">
                  {card.cardTitle || "Flashcard"}
                </div>
                <div className="mt-5 text-base font-medium leading-relaxed text-white md:text-[19px]">
                  {frontForDisplay}
                </div>
                <div className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  ↻ Tap to reveal answer
                </div>
              </div>
            </div>
            {/* BACK */}
            <div
              className={`rounded-[28px] border border-blue-500/30 bg-gradient-to-br from-slate-900 via-blue-950/60 to-slate-950 px-6 py-7 md:px-8 md:py-8 shadow-[0_24px_60px_rgba(15,23,42,0.55)] transition-transform duration-500 [transform-style:preserve-3d] ${
                flipped ? "block" : "[transform:rotateY(180deg)] [backface-visibility:hidden] hidden"
              }`}
            >
              <div className="flex flex-col gap-4">
                {breadcrumbParts.length > 0 ? (
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-300/80">
                    {breadcrumbParts.join("  ›  ")}
                  </div>
                ) : null}
                <div className="text-2xl font-bold leading-tight text-white md:text-[28px]">
                  {card.cardTitle || "Answer"}
                </div>

                {backStructure.primaryAnswer ? (
                  <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-300/80">
                      {card.cardTitle ? `${card.cardTitle.toUpperCase()} – Primary Answer` : "Primary Answer"}
                    </div>
                    <div className="mt-1 text-lg font-semibold leading-snug text-white md:text-[20px]">
                      {backStructure.primaryAnswer.value}
                    </div>
                  </div>
                ) : null}

                <SectionGroupsView groups={backStructure.groups} />
                <UngroupedBullets lines={backStructure.ungrouped} />

                {card.high_yield ? (
                  <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300/80">High Yield</div>
                    <div className="mt-1 text-sm font-medium text-white">{card.high_yield}</div>
                  </div>
                ) : null}
                {card.clinical_pearl ? (
                  <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">Clinical Pearl</div>
                    <div className="mt-1 text-sm font-medium text-white">{card.clinical_pearl}</div>
                  </div>
                ) : null}
                {card.memory_tip ? (
                  <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">Memory Tip</div>
                    <div className="mt-1 text-sm font-medium text-white">{card.memory_tip}</div>
                  </div>
                ) : null}
                {card.references && card.references.length ? (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">References</div>
                    <ul className="mt-1.5 space-y-1 text-sm text-slate-100">
                      {card.references.map((ref, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-emerald-400">•</span>
                          <span>{ref}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {showHints ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {SAMPLE_PRESETS.filter((p) => card.normalizedTags.includes(p.key)).map((p) => (
                      <span key={p.key} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TINT_BG[p.tone] ?? TINT_BG.slate}`}>
                        #{p.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                ↻ Tap to see the question
              </div>
            </div>
          </div>
            );
          })()}

          {/* Hint row */}
          {!flipped ? (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <button type="button" onClick={() => grade(0)} aria-label="Mark again" className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-3 text-rose-200">
                😰 Again (1)
              </button>
              <button type="button" onClick={() => grade(2)} aria-label="Mark hard" className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 text-amber-200">
                😐 Hard (2)
              </button>
              <button type="button" onClick={() => grade(4)} aria-label="Mark good" className="rounded-2xl border border-blue-400/40 bg-blue-500/10 px-3 py-3 text-blue-200">
                🙂 Good (3)
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-3" role="group" aria-label="Grade card">
              {GRADE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => grade(opt.value)}
                  aria-label={`Rate ${opt.label}`}
                  className={`rounded-2xl border px-3 py-3 text-center text-xs font-medium transition ${
                    TINT_BG[opt.tint] ?? TINT_BG.slate
                  }`}
                >
                  <div className="text-xl">{opt.emoji}</div>
                  <div className="mt-1">{opt.label}</div>
                  <div className="text-[10px] opacity-70">~ {nextIntervalDays(opt.value, schedulesById[card.id])} d</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats footer */}
      <div className="border-t border-white/10 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Today's accuracy", value: `${accuracy}%`, icon: TrendingUp, tone: "emerald" },
            { label: "Current streak", value: streak, icon: Flame, tone: "amber" },
            { label: "Cards reviewed", value: studiedCount, icon: Target, tone: "blue" },
            { label: "Mastered today", value: masteredCount, icon: TrendingUp, tone: "violet" },
            { label: "Avg response time", value: `${Math.round(averageResponse(responseMsById))}s`, icon: Timer, tone: "sky" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <span>{stat.label}</span>
                  <Icon className="h-3.5 w-3.5 text-blue-300" />
                </div>
                <div className="mt-1 text-base font-semibold text-white">{stat.value}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Lesson", value: lessonTitle ? lessonTitle.slice(0, 26) : "Personal deck" },
            { label: "Cards", value: `${total}` },
            { label: "Last seen", value: cardState.last_seen_at ? formatRelative(cardState.last_seen_at) : "Never" },
            { label: "Next review", value: formatRelative(schedulesById[card.id]?.dueAt ?? new Date().toISOString()) },
            { label: "Difficulty", value: (schedulesById[card.id]?.ease ?? 2.5).toFixed(2) },
          ].map((field, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-300">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{field.label}</div>
              <div className="mt-0.5 truncate text-sm text-white">{field.value}</div>
            </div>
          ))}
        </div>
      </div>

      {showSettings ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-white/10 bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-lg font-semibold text-white">Session Settings</div>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-sm text-slate-300 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {[
                { key: "limit", label: "Cards per session", control: <input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value || 1)))} className="w-24 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-sm text-white" /> },
                { key: "difficult", label: "Difficult cards only", control: <Switch on={difficultOnly} onChange={() => setDifficultOnly((v) => !v)} /> },
                { key: "mastered", label: "Mastered cards only", control: <Switch on={masteredOnly} onChange={() => setMasteredOnly((v) => !v)} /> },
                { key: "timer", label: "Show timer per card", control: <Switch on={timer} onChange={() => setTimer((v) => !v)} /> },
                { key: "audio", label: "Audio feedback after grading", control: <Switch on={audio} onChange={() => setAudio((v) => !v)} /> },
                { key: "showHints", label: "Show memory hints / tags", control: <Switch on={showHints} onChange={() => setShowHints((v) => !v)} /> },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm text-white">{row.label}</div>
                  {row.control}
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-right">
              <button type="button" onClick={() => setShowSettings(false)} className="rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm text-blue-200">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
    </div>
  );
}

function nextIntervalDays(grade: Grade, schedule?: InitialSchedule) {
  const next = sm2({ ease: schedule?.ease ?? 2.5, intervalDays: schedule?.intervalDays ?? 0, repetitions: schedule?.repetitions ?? 0 }, grade);
  return next.intervalDays;
}

function averageResponse(map: Record<string, number>) {
  const xs = Object.values(map);
  if (!xs.length) return 0;
  return Math.round(xs.reduce((sum, v) => sum + v, 0) / xs.length / 1000);
}

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${on ? "border-emerald-400/40 bg-emerald-500/30" : "border-white/10 bg-white/5"}`}
    >
      <span
        className={`absolute h-5 w-5 transform rounded-full bg-white transition ${on ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
