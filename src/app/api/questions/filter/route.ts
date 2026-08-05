import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";
import { normalizeQuestions } from "@/lib/question-normalizer";

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") || "";
  const course = url.searchParams.get("course") || "";
  const count = Math.min(parseInt(url.searchParams.get("count") || "40", 10), 120);
  const exam = url.searchParams.get("exam") || "";
  const difficulty = (url.searchParams.get("difficulty") || "all").toLowerCase();

  const admin = createAdminClient();
  const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

  // Patterns that mark a tag as exam-specific (not subject/topic)
  const EXAM_TAG_PATTERNS = [/ifom/i, /usmle/i, /plab/i, /amc/i, /smle/i, /dha/i, /haad/i, /qchp/i, /prometric/i];
  const DIFF_TAG_PATTERNS = [/foundation/i, /intermediate/i, /advanced/i, /expert/i];

  let query = admin
    .from("questions")
    .select("id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption, video_url, lesson_id")
    .limit(Math.max(count * 5, 200));

  if (course) {
    const { data: lessons, error: lessonsError } = await admin
      .from("lessons")
      .select("id")
      .eq("course_id", course);
    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    }
    const lessonIds = (lessons ?? []).map((lesson: any) => lesson.id).filter(Boolean);
    if (!lessonIds.length) return NextResponse.json({ questions: [] });
    query = query.in("lesson_id", lessonIds);
  }

  if (difficulty !== "all") {
    query = query.ilike("difficulty", difficulty);
  }

  const { data: pool, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const subjectLower = subject.toLowerCase();
  const examNormalized = normalizeToken(exam);

  // Normalize all questions (handles embedded JS/JSON stems and old formats)
  const normalizedPool = normalizeQuestions((pool ?? []) as unknown[]);

  /**
   * matchesSubject:
   *   – empty / "general" / "all mixed" → all questions pass
   *   – otherwise look at semantic (non-exam, non-difficulty) tags for a match.
   *
   * Matching rules (applied per tag):
   *   1. The tag contains the full subject filter (e.g. tag="Endocrine, Diabetes & Metabolism"
   *      matches filter="endocrine").
   *   2. The subject filter starts with the tag — only when the tag is ≥4 chars AND is a
   *      word-bounded prefix (e.g. tag="nbme" matches filter="nbme general medical quizzes").
   *      Requires the match to fall on a word boundary so short common words like "general"
   *      don't accidentally match "nbme general medical quizzes".
   *
   * We deliberately do NOT use the reverse `subjectLower.includes(t)` because short tags
   * like "general" or "medicine" would then incorrectly match long subject names.
   */
  const matchesSubject = (q: any) => {
    if (!subjectLower || subjectLower === "general" || subjectLower === "all mixed") return true;
    const tags = (q.tags || []) as string[];
    const semantic = tags.filter(
      (t) =>
        !EXAM_TAG_PATTERNS.some((rx) => rx.test(t)) &&
        !DIFF_TAG_PATTERNS.some((rx) => rx.test(t)),
    );
    const semanticLower = semantic.map((t) => t.toLowerCase());

    // Special case: Obs & Gynae combined
    if (subjectLower.includes("obstetrics") && subjectLower.includes("gyne")) {
      return semanticLower.some(
        (t) => t.includes("obstetric") || t.includes("gyn") || t.includes("gyne") || t.includes("obgyn"),
      );
    }

    // If no semantic tags at all:
    //   • Completely untagged questions (tags=[]) are universal → match any subject.
    //   • Questions whose tags are ALL exam/difficulty-specific (e.g. ["IFOM_CSE"]) are
    //     exam-scoped but NOT subject-scoped. They must NOT leak into per-subject sessions.
    if (!semanticLower.length) return tags.length === 0;

    return semanticLower.some((t) => {
      // Rule 1: tag contains the full subject name (e.g. "endocrine, diabetes" ⊇ "endocrine")
      if (t.includes(subjectLower)) return true;
      // Rule 2: subject starts with the tag on a word boundary, tag is meaningful (≥4 chars)
      // e.g. tag="nbme" → subject "nbme general medical quizzes" starts with "nbme" + non-alpha
      if (t.length >= 4 && (subjectLower === t || subjectLower.startsWith(t + " ") || subjectLower.startsWith(t + "-"))) return true;
      return false;
    });
  };

  /**
   * matchesExam:
   *   – no exam param → all questions pass
   *   – question has NO exam-specific tag → treat as "universal", pass for any exam
   *   – question HAS exam-specific tags → must match the requested exam
   *
   * This lets questions uploaded without an exam tag appear in every QBank session
   * instead of being silently filtered out.
   */
  const matchesExam = (q: any) => {
    if (!examNormalized) return true;
    const tags = (q.tags || []) as string[];
    const examSpecificTags = tags.filter((t) => EXAM_TAG_PATTERNS.some((rx) => rx.test(t)));
    // No exam tag → universal question, matches any exam
    if (!examSpecificTags.length) return true;
    // Has exam tags → must match the requested exam
    return examSpecificTags.some((t) => normalizeToken(t) === examNormalized);
  };

  // Shuffle the pool so every session gets a different set of questions
  const filteredPool = normalizedPool.filter((q: any) => matchesSubject(q) && matchesExam(q));
  for (let k = filteredPool.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [filteredPool[k], filteredPool[j]] = [filteredPool[j], filteredPool[k]];
  }
  const filtered = filteredPool.slice(0, count);

  return NextResponse.json({ questions: filtered });
}
