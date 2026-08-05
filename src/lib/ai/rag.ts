import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { embed } from "./engine";
import {
  extractFlashcardIndexText,
  extractLessonIndexText,
  extractNoteIndexText,
  extractQuestionIndexText,
} from "./source-text";

const CHUNK = 1200;
const OVERLAP = 150;

export type RetrievedChunk = {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  similarity: number;
  title: string;
  source_label: string;
  lesson_kind?: string | null;
};

type RawChunk = {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  similarity: number;
};

type LessonRow = {
  id: string;
  title: string;
  kind: string | null;
  html_body?: string | null;
  meta?: Record<string, unknown> | null;
  visible?: boolean | null;
};

type QuestionRow = {
  id: string;
  stem: string;
  explanation?: string | null;
  choices?: Array<{ key?: string; text?: string }> | null;
  tags?: string[] | null;
};

type FlashcardRow = {
  id: string;
  front: string;
  back: string;
  tags?: string[] | null;
};

type NoteRow = {
  id: string;
  body: string;
};

export function chunkText(input: string): string[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK - OVERLAP) {
    out.push(text.slice(i, i + CHUNK));
    if (i + CHUNK >= text.length) break;
  }
  return out;
}

const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

export async function indexSource(source_type: string, source_id: string, text: string) {
  const supabase = createAdminClient();
  const chunks = chunkText(text);
  if (!chunks.length) return { indexed: 0 };

  const hashes = chunks.map(hash);
  const { data: existing } = await supabase
    .from("rag_chunks")
    .select("content_hash")
    .eq("source_type", source_type)
    .eq("source_id", source_id)
    .in("content_hash", hashes);

  const known = new Set((existing ?? []).map((r: { content_hash: string }) => r.content_hash));
  const fresh = chunks.map((c, i) => ({ c, h: hashes[i] })).filter(({ h }) => !known.has(h));
  if (!fresh.length) return { indexed: 0, cached: chunks.length };

  const vectors = await embed(fresh.map((f) => f.c));
  const rows = fresh.map((f, i) => ({
    source_type,
    source_id,
    content: f.c,
    content_hash: f.h,
    embedding: vectors[i] as never,
  }));

  const { error } = await supabase.from("rag_chunks").upsert(rows, {
    onConflict: "source_type,source_id,content_hash",
  });
  if (error) throw error;
  return { indexed: rows.length };
}

function sourceBoost(source_type: string, lessonKind?: string | null) {
  if (source_type === "question") return 0.28;
  if (source_type === "lesson" && lessonKind === "html") return 0.20;
  if (source_type === "lesson" && lessonKind === "pdf") return 0.14;
  if (source_type === "lesson") return 0.18;
  if (source_type === "flashcard") return 0.08;
  if (source_type === "note") return 0.04;
  return 0;
}

function lessonLabel(lesson: LessonRow) {
  if ((lesson.meta as Record<string, unknown> | null)?.type === "video") return "Video Session";
  if (lesson.kind === "pdf") return "PDF Lesson";
  if (lesson.kind === "html") return "HTML Lesson";
  return "Lesson";
}

async function resolveHits(raw: RawChunk[]) {
  const supabase = createAdminClient();
  const ids = {
    lesson: [...new Set(raw.filter((r) => r.source_type === "lesson").map((r) => r.source_id))],
    question: [...new Set(raw.filter((r) => r.source_type === "question").map((r) => r.source_id))],
    flashcard: [...new Set(raw.filter((r) => r.source_type === "flashcard").map((r) => r.source_id))],
    note: [...new Set(raw.filter((r) => r.source_type === "note").map((r) => r.source_id))],
  };

  const [lessonsRes, questionsRes, flashcardsRes, notesRes] = await Promise.all([
    ids.lesson.length
      ? supabase.from("lessons").select("id,title,kind,html_body,meta,visible").in("id", ids.lesson)
      : Promise.resolve({ data: [] as LessonRow[] }),
    ids.question.length
      ? supabase.from("questions").select("id,stem,explanation,choices,tags").in("id", ids.question)
      : Promise.resolve({ data: [] as QuestionRow[] }),
    ids.flashcard.length
      ? supabase.from("flashcards").select("id,front,back,tags").in("id", ids.flashcard)
      : Promise.resolve({ data: [] as FlashcardRow[] }),
    ids.note.length
      ? supabase.from("notes").select("id,body").in("id", ids.note)
      : Promise.resolve({ data: [] as NoteRow[] }),
  ]);

  const lessons = new Map((lessonsRes.data ?? []).map((row) => [row.id, row]));
  const questions = new Map((questionsRes.data ?? []).map((row) => [row.id, row]));
  const flashcards = new Map((flashcardsRes.data ?? []).map((row) => [row.id, row]));
  const notes = new Map((notesRes.data ?? []).map((row) => [row.id, row]));

  const dedup = new Map<string, RetrievedChunk>();

  for (const hit of raw) {
    let resolved: RetrievedChunk | null = null;

    if (hit.source_type === "lesson") {
      const lesson = lessons.get(hit.source_id);
      if (!lesson || lesson.visible === false) continue;
      resolved = {
        ...hit,
        title: lesson.title,
        lesson_kind: lesson.kind,
        source_label: lessonLabel(lesson),
        content: extractLessonIndexText(lesson) || hit.content,
      };
    } else if (hit.source_type === "question") {
      const question = questions.get(hit.source_id);
      if (!question) continue;
      resolved = {
        ...hit,
        title: question.stem.slice(0, 96),
        source_label: "Question Bank",
        content: extractQuestionIndexText(question) || hit.content,
      };
    } else if (hit.source_type === "flashcard") {
      const card = flashcards.get(hit.source_id);
      if (!card) continue;
      resolved = {
        ...hit,
        title: card.front.slice(0, 96),
        source_label: "Flashcard",
        content: extractFlashcardIndexText(card) || hit.content,
      };
    } else if (hit.source_type === "note") {
      const note = notes.get(hit.source_id);
      if (!note) continue;
      resolved = {
        ...hit,
        title: "Personal Note",
        source_label: "Note",
        content: extractNoteIndexText(note) || hit.content,
      };
    }

    if (!resolved) continue;
    const key = `${resolved.source_type}:${resolved.source_id}`;
    const current = dedup.get(key);
    if (!current || current.similarity < resolved.similarity) dedup.set(key, resolved);
  }

  return [...dedup.values()];
}

export async function retrieve(query: string, k = 6) {
  const [qv] = await embed([query]);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_rag_chunks", {
    query_embedding: qv as never,
    match_count: Math.max(24, k * 4),
  });
  if (error) throw error;

  const resolved = await resolveHits((data ?? []) as RawChunk[]);
  return resolved
    .sort((a, b) => {
      const aScore = a.similarity + sourceBoost(a.source_type, a.lesson_kind);
      const bScore = b.similarity + sourceBoost(b.source_type, b.lesson_kind);
      return bScore - aScore;
    })
    .slice(0, k);
}
