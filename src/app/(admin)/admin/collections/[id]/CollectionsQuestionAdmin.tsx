"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Video,
  VideoOff,
  Check,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";

type Question = {
  id: string;
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string | null;
  difficulty: string | null;
  tags: string[];
  image_path?: string | null;
  image_caption?: string | null;
  video_url?: string | null;
};

type Lesson = {
  id: string;
  title: string;
  course_id: string | null;
  kind: string | null;
};

// Extract YouTube embed URL from any YouTube URL
function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let vid = "";
    if (u.hostname.includes("youtu.be")) {
      vid = u.pathname.replace("/", "");
    } else if (u.hostname.includes("youtube.com")) {
      vid = u.searchParams.get("v") ?? "";
    }
    if (!vid) return null;
    const start = u.searchParams.get("t") ? `?start=${u.searchParams.get("t")}` : "";
    return `https://www.youtube.com/embed/${vid}${start}`;
  } catch {
    return null;
  }
}

function QuestionCard({
  q,
  index,
}: {
  q: Question;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [videoInput, setVideoInput] = useState(q.video_url ?? "");
  const [currentVideo, setCurrentVideo] = useState(q.video_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const embedUrl = currentVideo ? toYouTubeEmbed(currentVideo) : null;
  const previewEmbedUrl = videoInput ? toYouTubeEmbed(videoInput) : null;

  async function saveVideo(url: string | null) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: q.id, video_url: url ?? "" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save");
      }
      setCurrentVideo(url ?? "");
      setVideoInput(url ?? "");
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const hasVideo = Boolean(currentVideo);

  return (
    <div
      className="rounded-[20px] border overflow-hidden"
      style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
    >
      {/* Question header */}
      <button
        className="w-full text-left p-5 flex items-start gap-4"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Number badge */}
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: "var(--c-elevated)", color: "var(--c-text-3)" }}
        >
          {index + 1}
        </div>

        {/* Stem */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-6 line-clamp-2"
            style={{ color: "var(--c-text-1)" }}
          >
            {q.stem}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {q.difficulty && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "var(--c-elevated)", color: "var(--c-text-4)" }}
              >
                {q.difficulty}
              </span>
            )}
            {/* Video status badge */}
            {hasVideo ? (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(34,197,94,0.12)", color: "rgb(34,197,94)" }}
              >
                <Video className="h-3 w-3" />
                فيديو مضاف
              </span>
            ) : (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--c-elevated)", color: "var(--c-text-4)" }}
              >
                <VideoOff className="h-3 w-3" />
                لا يوجد فيديو
              </span>
            )}
          </div>
        </div>

        {/* Expand icon */}
        <div className="shrink-0 mt-1" style={{ color: "var(--c-text-4)" }}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="border-t px-5 pb-5 pt-4 space-y-4"
          style={{ borderColor: "var(--c-border)" }}
        >
          {/* Choices */}
          <div className="space-y-2">
            {q.choices.map((ch) => (
              <div
                key={ch.key}
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm"
                style={{
                  background:
                    ch.key === q.answer_key
                      ? "rgba(34,197,94,0.1)"
                      : "var(--c-elevated)",
                  border: `1px solid ${
                    ch.key === q.answer_key
                      ? "rgba(34,197,94,0.3)"
                      : "var(--c-border)"
                  }`,
                  color: ch.key === q.answer_key ? "rgb(34,197,94)" : "var(--c-text-2)",
                }}
              >
                <span className="font-bold shrink-0">{ch.key}.</span>
                <span>{ch.text}</span>
              </div>
            ))}
          </div>

          {/* Explanation */}
          {q.explanation && (
            <div
              className="rounded-xl px-4 py-3 text-sm leading-6"
              style={{ background: "var(--c-elevated)", color: "var(--c-text-2)" }}
            >
              <span className="font-semibold" style={{ color: "var(--c-text-1)" }}>
                Explanation:{" "}
              </span>
              {q.explanation}
            </div>
          )}

          {/* ── VIDEO SECTION ── */}
          <div
            className="rounded-[16px] border p-4 space-y-3"
            style={{ borderColor: "var(--c-border)", background: "var(--c-bg)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" style={{ color: "var(--c-brand)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>
                  Video Explanation
                </span>
              </div>
              {!editing && (
                <button
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ background: "var(--c-brand)", color: "#fff" }}
                  onClick={() => {
                    setVideoInput(currentVideo);
                    setEditing(true);
                  }}
                >
                  {hasVideo ? "تعديل" : "إضافة فيديو"}
                </button>
              )}
            </div>

            {/* Current video preview */}
            {!editing && hasVideo && embedUrl && (
              <div className="space-y-2">
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: "56.25%" }}>
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={currentVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs"
                    style={{ color: "var(--c-brand)" }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    فتح الرابط
                  </a>
                  <button
                    className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                    onClick={() => saveVideo(null)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    حذف الفيديو
                  </button>
                </div>
              </div>
            )}

            {!editing && !hasVideo && (
              <p className="text-xs" style={{ color: "var(--c-text-4)" }}>
                لم يُضف فيديو بعد لهذا السؤال.
              </p>
            )}

            {/* Edit form */}
            {editing && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--c-text-3)" }}>
                    رابط YouTube
                  </label>
                  <input
                    type="url"
                    value={videoInput}
                    onChange={(e) => { setVideoInput(e.target.value); setSaveError(null); }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
                    style={{
                      background: "var(--c-card)",
                      borderColor: "var(--c-border)",
                      color: "var(--c-text-1)",
                    }}
                    dir="ltr"
                  />
                </div>

                {/* Live preview */}
                {previewEmbedUrl && (
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={previewEmbedUrl}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {videoInput && !previewEmbedUrl && (
                  <p className="text-xs" style={{ color: "#f59e0b" }}>
                    الرابط لا يبدو رابط YouTube صحيح — سيُحفظ كما هو.
                  </p>
                )}

                {saveError && (
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    {saveError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ background: "var(--c-brand)", color: "#fff" }}
                    onClick={() => saveVideo(videoInput || null)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    حفظ
                  </button>
                  <button
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ background: "var(--c-elevated)", color: "var(--c-text-2)" }}
                    onClick={() => { setEditing(false); setVideoInput(currentVideo); setSaveError(null); }}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                    إلغاء
                  </button>
                  {currentVideo && (
                    <button
                      className="mr-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                      onClick={() => saveVideo(null)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      حذف
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CollectionsQuestionAdmin({
  lesson,
  questions,
}: {
  lesson: Lesson;
  questions: Question[];
}) {
  const withVideo = questions.filter((q) => q.video_url).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back */}
      <Link
        href="/admin/collections"
        className="inline-flex items-center gap-2 mb-6 text-sm"
        style={{ color: "var(--c-text-3)" }}
      >
        <ArrowLeft className="h-4 w-4" />
        كل Collections
      </Link>

      {/* Header */}
      <div className="mb-1 flex items-center gap-2" style={{ color: "var(--c-brand)" }}>
        <Video className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-[0.18em]">Video Management</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>
        {lesson.title}
      </h1>

      {/* Stats bar */}
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <span className="text-sm" style={{ color: "var(--c-text-3)" }}>
          {questions.length} سؤال
        </span>
        <span className="text-sm" style={{ color: "var(--c-text-3)" }}>
          {withVideo} / {questions.length} فيديو مضاف
        </span>
        {questions.length > 0 && (
          <div
            className="flex-1 h-2 rounded-full overflow-hidden min-w-[80px]"
            style={{ background: "var(--c-elevated)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((withVideo / questions.length) * 100)}%`,
                background: "var(--c-brand)",
              }}
            />
          </div>
        )}
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--c-brand)" }}
        >
          {questions.length > 0 ? Math.round((withVideo / questions.length) * 100) : 0}%
        </span>
      </div>

      {/* Instructions */}
      <p className="mt-3 text-sm" style={{ color: "var(--c-text-3)" }}>
        اضغط على أي سؤال لعرضه وإضافة / تعديل الفيديو التوضيحي الخاص به.
      </p>

      {/* Questions */}
      <div className="mt-6 space-y-3">
        {questions.length === 0 ? (
          <div
            className="rounded-[24px] border p-10 text-center"
            style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--c-text-4)" }}>
              لا توجد أسئلة في هذه المجموعة.
            </p>
          </div>
        ) : (
          questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)
        )}
      </div>
    </div>
  );
}
