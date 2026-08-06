"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookOpen, ChevronRight, ListChecks, Loader2, PencilLine, Send, X } from "lucide-react";
import InlineBookmark from "./InlineBookmark";
import InlineMaterialViewer from "./InlineMaterialViewer";
import SplitNotes from "./SplitNotes";
import ProgressBar from "./ProgressBar";
import { useStudy } from "@/contexts/StudyContext";
import { classifyRedirect, openExternalIfAllowed } from "@/lib/study/external-redirect";

export type Question = { id: string; stem: string; options: string[]; rationale?: string };

export type StudyScreenProps = {
  lessonId: string;
  lessonTitle: string;
  courseId: string | null;
  videoType: "youtube" | "telegram" | "direct" | "none";
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  hasDirectVideo: boolean;
  questions: Question[];
  playlistQuestionsTotal: number;
  materials: { label: string; url: string; mime?: string | null }[];
};

/**
 * The redesigned compact study screen.
 *
 * Layout (top to bottom):
 *   ────────────────────────────────────
 *           VIDEO  (or external CTA)
 *   ────────────────────────────────────
 *             Notes  Q-Bank  Bookmarks
 *   ────────────────────────────────────
 *
 * The split-notes drawer slides up next to the video. Q-Bank questions
 * advance inline without a page reload. The bookmark is the small star
 * above each question (the list of bookmarks lives elsewhere).
 *
 * Three small buttons replace the long column of cards. No new fetches
 * on each button click — state lives in context.
 */
export default function StudyScreen(props: StudyScreenProps) {
  const { state, dispatch } = useStudy();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);
  const qbankRef = useRef<HTMLDivElement | null>(null);

  const [openMaterial, setOpenMaterial] = useState<{ url: string; mime?: string | null; label: string } | null>(null);

  // Hydrate session when the lesson changes.
  useEffect(() => {
    dispatch({
      type: "OPEN_LESSON",
      payload: {
        lessonId: props.lessonId,
        lessonTitle: props.lessonTitle,
        courseId: props.courseId,
        videoType: props.videoType,
        videoUrl: props.videoUrl,
        returnKey: `${props.lessonId}@${state.progress[props.lessonId]?.position ?? 0}`,
      },
    });
    // Visibility handler: when user returns from external YT/TG, restore
    // the exact lesson + resume position.
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      const stored = state.progress[props.lessonId];
      if (stored && videoRef.current && stored.position > 1) {
        videoRef.current.currentTime = stored.position;
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.lessonId]);

  // Listen for material open events emitted by MaterialCard.
  useEffect(() => {
    function onMsg(event: Event) {
      const e = event as CustomEvent<{ lessonId: string; url: string; mime?: string | null; label: string }>;
      if (!e.detail || e.detail.lessonId !== props.lessonId) return;
      setOpenMaterial({ url: e.detail.url, mime: e.detail.mime, label: e.detail.label });
    }
    window.addEventListener("study:open-material", onMsg);
    return () => window.removeEventListener("study:open-material", onMsg);
  }, [props.lessonId]);

  function persistVideo(position: number, duration: number) {
    dispatch({ type: "SET_TIME", position, duration });
    dispatch({
      type: "SET_PROGRESS",
      lessonId: props.lessonId,
      progress: {
        position,
        duration,
        completed: duration > 0 ? position / duration >= 0.95 : false,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const externalDecision = useMemo(() => classifyRedirect(props.videoUrl), [props.videoUrl]);

  function openExternal() {
    openExternalIfAllowed(props.videoUrl);
  }

  const idx = state.qbankCursor[props.lessonId] ?? 0;
  const total = Math.max(props.questions.length, 1);
  const currentQuestion = props.questions[idx % props.questions.length];

  function nextQuestion() {
    dispatch({ type: "NEXT_QBANK", lessonId: props.lessonId, total: props.playlistQuestionsTotal || total });
  }

  return (
    <div className="card overflow-hidden border-ink-800 bg-ink-950/70">
      {/* VIDEO */}
      <div className="border-b border-ink-800 bg-black">
        <div className="aspect-video w-full">
          {props.hasDirectVideo && props.videoEmbedUrl ? (
            <video
              ref={videoRef}
              src={props.videoEmbedUrl}
              controls
              playsInline
              className="h-full w-full"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                dispatch({ type: "SET_TIME", position: v.currentTime, duration: v.duration });
                const stored = state.progress[props.lessonId];
                if (stored && stored.position > 1 && stored.position < v.duration - 1) {
                  v.currentTime = stored.position;
                }
              }}
              onTimeUpdate={(e) => persistVideo(e.currentTarget.currentTime, e.currentTarget.duration || 0)}
              onEnded={() => persistVideo(state.session.duration, state.session.duration)}
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : props.videoType === "youtube" || props.videoType === "telegram" ? (
            <div className="grid h-full w-full place-items-center bg-ink-950 p-6 text-center">
              <div className="max-w-md space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                  {externalDecision.kind === "youtube" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </div>
                <p className="text-sm text-slate-300">
                  This lecture is hosted on {externalDecision.kind === "youtube" ? "YouTube" : "Telegram"} and opens in the official app.
                </p>
                <button
                  type="button"
                  onClick={openExternal}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Open lecture <ChevronRight className="h-4 w-4" />
                </button>
                <p className="text-[11px] text-slate-500">
                  Notes, progress, and bookmarks stay linked here. When you return to this app, the lecture resumes at the same point.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center bg-ink-950 p-6 text-center text-sm text-slate-500">
              No video is attached yet.
            </div>
          )}
        </div>
      </div>

      {/* PROGRESS — one thin line, replaces four big cards */}
      <div className="px-4 py-3">
        <ProgressBar />
      </div>

      {/* THREE SMALL BUTTONS */}
      <div className="grid grid-cols-3 gap-2 border-t border-ink-800 bg-ink-900/70 px-4 py-3 text-[12px] font-semibold text-slate-200">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "TOGGLE_PANEL", panel: "notes" });
            notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-800 bg-ink-950/70 px-3 py-2 transition hover:border-brand/40 hover:text-white"
        >
          <PencilLine className="h-3.5 w-3.5" /> Notes
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "TOGGLE_PANEL", panel: "qbank" });
            qbankRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-800 bg-ink-950/70 px-3 py-2 transition hover:border-brand/40 hover:text-white"
        >
          <ListChecks className="h-3.5 w-3.5" /> Q-Bank
        </button>
        <div className="flex items-center justify-center gap-1.5 rounded-xl border border-ink-800 bg-ink-950/70 px-3 py-2">
          <Bookmark className="h-3.5 w-3.5 text-amber-300" />
          <InlineBookmark lessonId={props.lessonId} hint />
        </div>
      </div>

      {/* NOTES drawer — slides next to the video when opened */}
      {state.session.notesOpen ? (
        <div ref={notesRef} className="border-t border-ink-800 p-4">
          <SplitNotes lessonId={props.lessonId} lessonTitle={props.lessonTitle} currentTime={state.session.currentTime} />
        </div>
      ) : null}

      {/* Q-Bank inline runner — no page reload between questions */}
      {state.session.qbankOpen ? (
        <div ref={qbankRef} className="border-t border-ink-800 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              <BookOpen className="h-3.5 w-3.5 text-brand" /> Q-Bank
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              Question {idx + 1} / {props.playlistQuestionsTotal || total}
            </div>
          </div>
          {currentQuestion ? (
            <div className="space-y-3 rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-6 text-white">{currentQuestion.stem}</p>
                <InlineBookmark lessonId={`${props.lessonId}::${currentQuestion.id}`} />
              </div>
              <ul className="space-y-2">
                {currentQuestion.options.map((opt, o) => (
                  <li key={o} className="rounded-xl border border-ink-800 bg-ink-950/70 px-3 py-2 text-[13px] text-slate-200 transition hover:border-brand/40">
                    {opt}
                  </li>
                ))}
              </ul>
              {currentQuestion.rationale ? (
                <p className="text-[12px] leading-5 text-slate-400">{currentQuestion.rationale}</p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-dark"
                >
                  Next question <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5 text-sm text-slate-500">
              No questions are attached to this lesson yet.
            </div>
          )}
        </div>
      ) : null}

      {/* MATERIAL VIEWER — opens inline, no new page */}
      {openMaterial ? (
        <div className="border-t border-ink-800 p-4">
          <InlineMaterialViewer
            lessonId={props.lessonId}
            url={openMaterial.url}
            mime={openMaterial.mime}
            label={openMaterial.label}
            onClose={() => setOpenMaterial(null)}
          />
        </div>
      ) : null}

      {props.materials.length ? (
        <div className="space-y-2 border-t border-ink-800 p-4">
          {props.materials.map((m) => (
            <div key={`${props.lessonId}-${m.url}`} className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2">
              <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Lecture Material</span>
              <span className="truncate text-[12px] text-slate-300">{m.label}</span>
              <button
                type="button"
                onClick={() =>
                  setOpenMaterial({ url: m.url, mime: m.mime, label: m.label })
                }
                className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-dark"
              >
                Open <ChevronRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const decision = classifyRedirect(m.url);
                  if (decision.kind !== "internal-only") openExternalIfAllowed(m.url);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-950/70 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:text-white"
              >
                <Send className="h-3 w-3" /> {classifyRedirect(m.url).kind === "telegram" ? "Telegram" : classifyRedirect(m.url).kind === "youtube" ? "YouTube" : "—"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-ink-800 px-4 py-2 text-[11px] text-slate-500">
        <X className="h-3 w-3" />
        External opening is limited to YouTube and Telegram. Everything else stays in-app — no download, no new tab.
      </div>
    </div>
  );
}
