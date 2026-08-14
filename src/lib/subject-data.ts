import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import {
  classifySubjectFromText,
  getSubjectMeta,
  getSubjectMetaBySlug,
  normalizeSubjectTitle,
  SUBJECT_CATALOG,
  subjectSlugFromTitle,
  type SubjectMeta,
} from "@/lib/subjects";

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  meta?: Record<string, unknown> | null;
  visible?: boolean | null;
  position?: number | null;
};

type QuestionRow = {
  id: string;
  lesson_id?: string | null;
  tags?: string[] | null;
  stem?: string | null;
};

type FlashcardRow = {
  id: string;
  lesson_id?: string | null;
  tags?: string[] | null;
  front: string;
  back: string;
};

type SubjectOverview = SubjectMeta & {
  exam: string;
  videoCount: number;
  documentCount: number;
  qbankCount: number;
  keyPointCount: number;
  blockPreviews: Array<{ id: string; title: string; questionCount: number }>;
  officialBlocks: Array<{ id: string; title: string; questionCount: number; blockNumber: number }>;
  practicePoolCount: number;
  officialBlockQuestionTotal: number;
};

type SubjectDetail = {
  exam: string;
  subject: SubjectMeta;
  videos: LessonRow[];
  documents: LessonRow[];
  qbankSources: Array<{ id: string; title: string; questionCount: number }>;
  qbankQuestionCount: number;
  keyPoints: FlashcardRow[];
  officialBlocks: Array<{ id: string; title: string; questionCount: number; blockNumber: number }>;
  activeBlocks: Array<{ id: string; title: string; questionCount: number; blockNumber: number }>;
  practicePoolCount: number;
  officialBlockQuestionTotal: number;
  activeBlockQuestionTotal: number;
};

const SUBJECT_HINTS: Record<string, string[]> = {
  Neurology: ["neurology", "neurologic", "brain", "seizure", "stroke", "cranial"],
  "Gastrointestinal System": [
    "gastrointestinal", "gastric", "stomach", "intestin", "bowel", "colon", "rectal",
    "hepatic", "liver", "pancreas", "biliary", "bile", "esophag", "diarrhea",
    "constipation", "colitis", "crohn", "ibd", "gerd", "peptic", "ulcer",
    "hepatitis", "cirrhosis", "jaundice", "colorectal", "malabsorption", "celiac",
    "appendicitis", "hemorrhoid", "gi tract",
  ],
  Obstetrics: ["obstetric", "pregnancy", "pregnant", "antenatal", "prenatal", "labor", "delivery", "postpartum", "fetal", "maternal", "placenta", "obs", "obgyn"],
  Gynecology: ["gyne", "gyn", "gynecology", "gynecologic", "ovary", "ovarian", "uterus", "uterine", "cervix", "cervical", "pelvic", "menstrual", "contraception", "infertility", "obgyn"],
  Pediatrics: ["pediatric", "pediatrics", "child", "infant", "newborn", "adolescent", "vaccine", "vaccination"],
};

function lessonText(lesson: LessonRow) {
  const meta = lesson.meta ?? {};
  return [
    lesson.title,
    typeof meta.subject === "string" ? meta.subject : "",
    typeof meta.notes === "string" ? meta.notes : "",
    typeof meta.index_text === "string" ? meta.index_text : "",
    typeof meta.description === "string" ? meta.description : "",
    typeof meta.url === "string" ? meta.url : "",
    typeof meta.document_name === "string" ? meta.document_name : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function questionText(question: QuestionRow) {
  return [question.stem || "", ...(question.tags ?? [])].join("\n");
}

function flashcardText(card: FlashcardRow) {
  return [card.front, card.back, ...(card.tags ?? [])].join("\n");
}

function tagsMatchSubject(subjectTitle: string, tags?: string[] | null) {
  const normalizedSubject = normalizeSubjectTitle(subjectTitle);
  const normalizedTags = (tags ?? []).map((tag) => normalizeSubjectTitle(tag)).filter(Boolean);
  if (normalizedTags.includes(normalizedSubject)) return true;

  const loweredTags = (tags ?? []).map((tag) => tag.toLowerCase());
  if (normalizedSubject === "Obstetrics") {
    return loweredTags.some((tag) => tag.includes("obstetric") || tag === "obs" || tag.includes("obgyn"));
  }
  if (normalizedSubject === "Gynecology") {
    return loweredTags.some((tag) => tag.includes("gyn") || tag.includes("gyne") || tag.includes("obgyn"));
  }
  return false;
}

function hintsMatchSubject(subjectTitle: string, value: string) {
  const hints = SUBJECT_HINTS[normalizeSubjectTitle(subjectTitle)] ?? [];
  if (!hints.length) return false;
  const lowered = value.toLowerCase();
  return hints.some((hint) => lowered.includes(hint));
}

function lessonAssignedSubject(lesson: LessonRow): string {
  const raw = typeof lesson.meta?.subject === "string" ? lesson.meta.subject.trim() : "";
  if (!raw) return "";
  // Try catalog lookup (normalised alias → canonical title)
  const catalogTitle = getSubjectMeta(normalizeSubjectTitle(raw))?.title ?? "";
  // Fall back to the raw value so manually-typed subjects still match
  return catalogTitle || raw;
}

/** Case-insensitive subject match: catalog title OR raw meta.subject value */
function subjectTitleMatches(assignedSubject: string, targetTitle: string): boolean {
  if (!assignedSubject) return false;
  return assignedSubject === targetTitle || assignedSubject.toLowerCase() === targetTitle.toLowerCase();
}

function normalizeQuestionStem(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512);
}

function blockSignalText(lesson: LessonRow | undefined, sourceTitle: string, sourceTags: string[] = []) {
  const meta = lesson?.meta ?? {};
  return [
    sourceTitle,
    lesson?.title ?? "",
    typeof meta.subject === "string" ? meta.subject : "",
    typeof meta.section === "string" ? meta.section : "",
    typeof meta.block_kind === "string" ? meta.block_kind : "",
    typeof meta.description === "string" ? meta.description : "",
    typeof meta.notes === "string" ? meta.notes : "",
    typeof meta.original_name === "string" ? meta.original_name : "",
    ...sourceTags,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function isActiveBlockSource(lesson: LessonRow | undefined, sourceTitle: string, sourceTags: string[] = []) {
  const meta = (lesson?.meta ?? {}) as Record<string, unknown>;
  const section = typeof meta.section === "string" ? meta.section.toLowerCase().trim() : "";
  const category = typeof meta.category === "string" ? meta.category.toLowerCase().trim() : "";
  const blockKind = typeof meta.block_kind === "string" ? meta.block_kind.toLowerCase().trim() : "";

  // Official / practice sources are not active by definition.
  if (Boolean(meta.is_official_block) || meta.fixed_block === true || blockKind === "official" || blockKind === "practice") return false;

  // Admin uploads routed to the QBank section should behave as Active QBank by default
  // unless they were explicitly marked official/practice above.
  if (Boolean(meta.is_active_qbank) || blockKind === "active" || section === "qbank" || section === "qbank-active" || category === "qbank" || category === "qbank-active") return true;

  const haystack = blockSignalText(lesson, sourceTitle, sourceTags);
  return /(active\s*qbank|active\s*qe\b|qe\s*active|active\s*questions?)/i.test(haystack);
}

function isOfficialBlockSource(lesson: LessonRow | undefined, sourceTitle: string, sourceTags: string[] = [], sourceId = "") {
  if (isActiveBlockSource(lesson, sourceTitle, sourceTags)) return false;
  if (lesson?.meta?.block_kind === "practice") return false;
  if (Boolean(lesson?.meta?.is_official_block) || lesson?.meta?.fixed_block === true || lesson?.meta?.block_kind === "official") return true;
  const haystack = blockSignalText(lesson, sourceTitle, sourceTags);
  return /(official\s*fixed\s*block|fixed\s*qbank\s*block|fixed\s*block|ifom\s*block|cardio_block_|official\b)/i.test(haystack);
}

function matchesSubject(subjectTitle: string, value: string, tags?: string[] | null) {
  const normalizedSubject = normalizeSubjectTitle(subjectTitle);
  if (tagsMatchSubject(normalizedSubject, tags)) return true;
  if (hintsMatchSubject(normalizedSubject, [value, ...(tags ?? [])].join("\n"))) return true;
  return classifySubjectFromText([value, ...(tags ?? [])].join("\n")) === normalizedSubject;
}

// Cache base data for 5 minutes to avoid redundant DB round-trips on every page load.
const loadBaseDataCached = unstable_cache(
  async (exam: string) => {
    const admin = createAdminClient();
    const [subjectsRes, lessonsRes, questionsRes, flashcardsRes] = await Promise.all([
      admin
        .from("exam_subject_configs")
        .select("subject_title, position")
        .eq("exam_code", exam)
        .eq("is_active", true)
        .order("position"),
      admin
        .from("lessons")
        .select("id,title,kind,meta,visible,position")
        .eq("visible", true)
        .order("position"),
      admin.from("questions").select("id,lesson_id,tags,stem"),
      admin.from("flashcards").select("id,lesson_id,tags,front,back"),
    ]);

    const configuredSubjects = (subjectsRes.data ?? [])
      .map((row: any) => normalizeSubjectTitle(row.subject_title))
      .filter(Boolean);

    const fallbackIfomSubjects = ["Neurology", "Gastrointestinal System", "Obstetrics", "Gynecology", "Pediatrics"];
    const subjectTitles = configuredSubjects.length
      ? Array.from(new Set([...configuredSubjects, ...fallbackIfomSubjects]))
      : SUBJECT_CATALOG.map((subject) => subject.title);

    const subjects = subjectTitles
      .map((title) => getSubjectMeta(title))
      .filter((subject): subject is SubjectMeta => Boolean(subject));

    return {
      exam,
      subjects,
      lessons: (lessonsRes.data ?? []) as LessonRow[],
      questions: (questionsRes.data ?? []) as QuestionRow[],
      flashcards: (flashcardsRes.data ?? []) as FlashcardRow[],
    };
  },
  ["subject-base-data"],
  { revalidate: 300, tags: ["subject-base-data"] }, // 5 minutes
);

async function loadBaseData(exam = "IFOM_CSE") {
  return loadBaseDataCached(exam);
}

export async function getSubjectOverviews(exam = "IFOM_CSE"): Promise<SubjectOverview[]> {
  const { subjects, lessons, questions, flashcards } = await loadBaseData(exam);

  return subjects.map((subject) => {
    const videos = lessons.filter((lesson) => {
      const type = typeof lesson.meta?.type === "string" ? String(lesson.meta?.type) : "";
      const assignedSubject = lessonAssignedSubject(lesson);
      return type === "video" && (assignedSubject ? subjectTitleMatches(assignedSubject, subject.title) : matchesSubject(subject.title, lessonText(lesson)));
    });

    // Documents: ONLY show if admin explicitly tagged meta.subject — no auto-detection fallback.
    const documents = lessons.filter((lesson) => {
      const type = typeof lesson.meta?.type === "string" ? String(lesson.meta?.type) : "";
      const assignedSubject = lessonAssignedSubject(lesson);
      const documentKinds = new Set(["html", "pdf", "pptx", "image", "html-file", "html-inline", "notes", "qbank"]);
      return type !== "video" && documentKinds.has(lesson.kind) && subjectTitleMatches(assignedSubject, subject.title);
    });

    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson] as const));
    const relevantQuestions = questions.filter((question) => {
      const lesson = question.lesson_id ? lessonMap.get(question.lesson_id) : null;
      const assignedSubject = lesson ? lessonAssignedSubject(lesson) : "";
      if (assignedSubject) return subjectTitleMatches(assignedSubject, subject.title);
      return matchesSubject(subject.title, questionText(question), question.tags);
    });
    const lessonName = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
    const sourceMap = new Map<string, { id: string; title: string; questionCount: number }>();
    const sourceStemSeen = new Map<string, Set<string>>();
    const sourceTagsMap = new Map<string, Set<string>>();

    for (const question of relevantQuestions) {
      const key = question.lesson_id || `pool-${subject.slug}`;
      const title = question.lesson_id ? lessonName.get(question.lesson_id) || subject.title : `${subject.title} Practice Pool`;
      const stemKey = normalizeQuestionStem(question.stem);
      const seen = sourceStemSeen.get(key) ?? new Set<string>();
      if (stemKey) {
        if (seen.has(stemKey)) continue;
        seen.add(stemKey);
        sourceStemSeen.set(key, seen);
      }
      const tagSet = sourceTagsMap.get(key) ?? new Set<string>();
      (question.tags ?? []).forEach((tag) => tagSet.add(tag));
      sourceTagsMap.set(key, tagSet);
      const existing = sourceMap.get(key) || { id: key, title, questionCount: 0 };
      existing.questionCount += 1;
      sourceMap.set(key, existing);
    }

    const qbankSources = [...sourceMap.values()].sort((a, b) => b.questionCount - a.questionCount || a.title.localeCompare(b.title));
    const keyPoints = flashcards.filter((card) => matchesSubject(subject.title, flashcardText(card), card.tags));

    const questionBackedActiveIds = new Set(
      qbankSources
        .filter((src) => isActiveBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())]))
        .map((src) => src.id),
    );
    const emptyActiveLessons = documents.filter((lesson) =>
      !questionBackedActiveIds.has(lesson.id) && isActiveBlockSource(lesson, lesson.title),
    );
    const activeBlocks = [
      ...qbankSources
        .filter((src) => isActiveBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())]))
        .map((src) => ({ id: src.id, title: src.title, questionCount: src.questionCount })),
      ...emptyActiveLessons.map((lesson) => ({ id: lesson.id, title: lesson.title, questionCount: 0 })),
    ].map((src, idx) => ({ ...src, blockNumber: idx + 1 }));
    const activeBlockQuestionTotal = activeBlocks.reduce((acc, b) => acc + b.questionCount, 0);

    const officialBlocks = qbankSources
      .filter((src) => isOfficialBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())], src.id))
      .map((src, idx) => ({ id: src.id, title: src.title, questionCount: src.questionCount, blockNumber: idx + 1 }));
    const officialBlockQuestionTotal = officialBlocks.reduce((acc, b) => acc + b.questionCount, 0);
    const practicePoolCount = Math.max(0, qbankSources.length - officialBlocks.length - questionBackedActiveIds.size);

    return {
      ...subject,
      exam,
      videoCount: videos.length,
      documentCount: documents.length,
      qbankCount: qbankSources.length,
      keyPointCount: keyPoints.length,
      blockPreviews: officialBlocks.length > 0 ? officialBlocks.slice(0, 4) : qbankSources.slice(0, 4),
      officialBlocks,
      activeBlocks,
      activeBlockQuestionTotal,
      practicePoolCount,
      officialBlockQuestionTotal,
    };
  });
}

export async function getSubjectDetail(slug: string, exam = "IFOM_CSE"): Promise<SubjectDetail | null> {
  const { subjects, lessons, questions, flashcards } = await loadBaseData(exam);
  const subject = getSubjectMetaBySlug(slug) || subjects.find((item) => item.slug === slug) || null;
  if (!subject) return null;

  const videos = lessons.filter((lesson) => {
    const type = typeof lesson.meta?.type === "string" ? String(lesson.meta?.type) : "";
    const assignedSubject = lessonAssignedSubject(lesson);
    return type === "video" && (assignedSubject ? subjectTitleMatches(assignedSubject, subject.title) : matchesSubject(subject.title, lessonText(lesson)));
  });

  // Documents: ONLY show if admin explicitly tagged meta.subject — no auto-detection fallback.
  const documents = lessons.filter((lesson) => {
    const type = typeof lesson.meta?.type === "string" ? String(lesson.meta?.type) : "";
    const assignedSubject = lessonAssignedSubject(lesson);
    const documentKinds = new Set(["html", "pdf", "pptx", "image", "html-file", "html-inline", "notes", "qbank"]);
    return type !== "video" && documentKinds.has(lesson.kind) && subjectTitleMatches(assignedSubject, subject.title);
  });

  const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson] as const));
  const relevantQuestions = questions.filter((question) => {
    const lesson = question.lesson_id ? lessonMap.get(question.lesson_id) : null;
    const assignedSubject = lesson ? lessonAssignedSubject(lesson) : "";
    if (assignedSubject) return subjectTitleMatches(assignedSubject, subject.title);
    return matchesSubject(subject.title, questionText(question), question.tags);
  });
  const lessonName = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const sourceMap = new Map<string, { id: string; title: string; questionCount: number }>();
  const sourceStemSeen = new Map<string, Set<string>>();
  const sourceTagsMap = new Map<string, Set<string>>();

  for (const question of relevantQuestions) {
    const key = question.lesson_id || `pool-${subject.slug}`;
    const title = question.lesson_id ? lessonName.get(question.lesson_id) || subject.title : `${subject.title} Practice Pool`;
    const stemKey = normalizeQuestionStem(question.stem);
    const seen = sourceStemSeen.get(key) ?? new Set<string>();
    if (stemKey) {
      if (seen.has(stemKey)) continue;
      seen.add(stemKey);
      sourceStemSeen.set(key, seen);
    }
    const tagSet = sourceTagsMap.get(key) ?? new Set<string>();
    (question.tags ?? []).forEach((tag) => tagSet.add(tag));
    sourceTagsMap.set(key, tagSet);
    const existing = sourceMap.get(key) || { id: key, title, questionCount: 0 };
    existing.questionCount += 1;
    sourceMap.set(key, existing);
  }

  const keyPoints = flashcards.filter((card) => matchesSubject(subject.title, flashcardText(card), card.tags));
  const qbankSources = [...sourceMap.values()].sort((a, b) => b.questionCount - a.questionCount || a.title.localeCompare(b.title));

  const questionBackedActiveIds = new Set(
    qbankSources
      .filter((src) => isActiveBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())]))
      .map((src) => src.id),
  );
  const emptyActiveLessons = documents.filter((lesson) =>
    !questionBackedActiveIds.has(lesson.id) && isActiveBlockSource(lesson, lesson.title),
  );
  const activeBlocks = [
    ...qbankSources
      .filter((src) => isActiveBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())]))
      .map((src) => ({ id: src.id, title: src.title, questionCount: src.questionCount })),
    ...emptyActiveLessons.map((lesson) => ({ id: lesson.id, title: lesson.title, questionCount: 0 })),
  ].map((src, idx) => ({ ...src, blockNumber: idx + 1 }));
  const activeBlockQuestionTotal = activeBlocks.reduce((acc, b) => acc + b.questionCount, 0);

  const officialBlocks = qbankSources
    .filter((src) => isOfficialBlockSource(lessons.find((l) => l.id === src.id), src.title, [...(sourceTagsMap.get(src.id) ?? new Set<string>())], src.id))
    .map((src, idx) => ({ id: src.id, title: src.title, questionCount: src.questionCount, blockNumber: idx + 1 }));
  const officialBlockQuestionTotal = officialBlocks.reduce((acc, b) => acc + b.questionCount, 0);
  const practicePoolCount = Math.max(0, qbankSources.length - officialBlocks.length - questionBackedActiveIds.size);

  return {
    exam,
    subject,
    videos,
    documents,
    qbankSources,
    qbankQuestionCount: relevantQuestions.length,
    keyPoints,
    officialBlocks,
    activeBlocks,
    practicePoolCount,
    officialBlockQuestionTotal,
    activeBlockQuestionTotal,
  };
}

export function subjectHref(title: string, exam = "IFOM_CSE") {
  return `/subjects/${subjectSlugFromTitle(title)}?exam=${encodeURIComponent(exam)}`;
}
