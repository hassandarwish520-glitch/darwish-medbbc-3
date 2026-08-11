import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";
import { normalizeQuestions } from "@/lib/question-normalizer";

function normalizeStem(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512);
}

function dedupeQuestions<T extends { stem?: string | null; id: string }>(questions: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const question of questions) {
    const key = normalizeStem(question.stem) || `id:${question.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }
  return deduped;
}

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") || "";
  const course = url.searchParams.get("course") || "";
  const block = url.searchParams.get("block") || "";
  const count = Math.min(parseInt(url.searchParams.get("count") || "40", 10), block ? 1000 : 120);
  const exam = url.searchParams.get("exam") || "";
  const difficulty = (url.searchParams.get("difficulty") || "all").toLowerCase();
  const filter = (url.searchParams.get("filter") || "").toLowerCase();

  const admin = createAdminClient();
  const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

  const EXAM_TAG_PATTERNS = [/ifom/i, /usmle/i, /plab/i, /amc/i, /smle/i, /dha/i, /haad/i, /qchp/i, /prometric/i];
  const DIFF_TAG_PATTERNS = [/foundation/i, /intermediate/i, /advanced/i, /expert/i];

  let query = admin
    .from("questions")
    .select("id, stem, choices, answer_key, explanation, difficulty, tags, image_path, image_caption, video_url, lesson_id, created_at")
    .limit(block ? 1000 : Math.max(count * 6, 240));

  if (block) {
    query = query.eq("lesson_id", block).order("created_at", { ascending: true });
  }

  if (course) {
    const { data: lessons, error: lessonsError } = await admin.from("lessons").select("id").eq("course_id", course);
    if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    const lessonIds = (lessons ?? []).map((lesson: any) => lesson.id).filter(Boolean);
    if (!lessonIds.length) return NextResponse.json({ questions: [] });
    query = query.in("lesson_id", lessonIds);
  }

  if (difficulty !== "all") {
    query = query.ilike("difficulty", difficulty);
  }

  const { data: pool, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subjectLower = subject.toLowerCase();
  const examNormalized = normalizeToken(exam);
  const normalizedPool = normalizeQuestions((pool ?? []) as unknown[]);

  const matchesSubject = (q: any) => {
    if (!subjectLower || subjectLower === "general" || subjectLower === "all mixed") return true;
    const tags = (q.tags || []) as string[];
    const semantic = tags.filter((t) => !EXAM_TAG_PATTERNS.some((rx) => rx.test(t)) && !DIFF_TAG_PATTERNS.some((rx) => rx.test(t)));
    const semanticLower = semantic.map((t) => t.toLowerCase());

    if (subjectLower.includes("obstetrics") && subjectLower.includes("gyne")) {
      return semanticLower.some((t) => t.includes("obstetric") || t.includes("gyn") || t.includes("gyne") || t.includes("obgyn"));
    }

    if (!semanticLower.length) return tags.length === 0;

    return semanticLower.some((t) => {
      if (t.includes(subjectLower)) return true;
      if (t.length >= 4 && (subjectLower === t || subjectLower.startsWith(t + " ") || subjectLower.startsWith(t + "-"))) return true;
      return false;
    });
  };

  const matchesExam = (q: any) => {
    if (!examNormalized) return true;
    const tags = (q.tags || []) as string[];
    const examSpecificTags = tags.filter((t) => EXAM_TAG_PATTERNS.some((rx) => rx.test(t)));
    if (!examSpecificTags.length) return true;
    return examSpecificTags.some((t) => normalizeToken(t) === examNormalized);
  };

  if (block) {
    return NextResponse.json({ questions: dedupeQuestions(normalizedPool) });
  }

  let eligibleQuestionIds: Set<string> | null = null;

  if (filter === "incorrect") {
    const { data: attempts, error: attemptsError } = await admin
      .from("question_attempts")
      .select("question_id, correct, created_at")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (attemptsError) return NextResponse.json({ error: attemptsError.message }, { status: 500 });

    const latestByQuestion = new Map<string, boolean>();
    for (const row of attempts ?? []) {
      if (!row.question_id || latestByQuestion.has(row.question_id)) continue;
      latestByQuestion.set(row.question_id, Boolean(row.correct));
    }
    eligibleQuestionIds = new Set([...latestByQuestion.entries()].filter(([, correct]) => !correct).map(([questionId]) => questionId));
  }

  if (filter === "bookmarked") {
    const { data: entries, error: bookmarkError } = await admin
      .from("medical_library_entries")
      .select("data")
      .eq("user_id", ctx.user.id)
      .eq("entry_type", "bookmark")
      .limit(10000);
    if (bookmarkError) return NextResponse.json({ error: bookmarkError.message }, { status: 500 });

    eligibleQuestionIds = new Set(
      (entries ?? [])
        .map((entry: any) => (entry?.data && typeof entry.data === "object" ? entry.data.question_id : null))
        .filter(Boolean),
    );
  }

  const filteredPool = dedupeQuestions(normalizedPool.filter((q: any) => {
    if (!matchesSubject(q) || !matchesExam(q)) return false;
    if (eligibleQuestionIds && !eligibleQuestionIds.has(q.id)) return false;
    return true;
  }));

  if (!block) {
    for (let k = filteredPool.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [filteredPool[k], filteredPool[j]] = [filteredPool[j], filteredPool[k]];
    }
  }

  const filtered = block ? filteredPool : filteredPool.slice(0, count);
  return NextResponse.json({ questions: filtered });
}
