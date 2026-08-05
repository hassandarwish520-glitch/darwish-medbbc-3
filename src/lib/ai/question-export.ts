import { buildZip } from "./zip";
import { createAdminClient } from "@/lib/supabase/server";

export const EXPORT_SCHEMA_VERSION = "1.0.0";
export const EXPORT_FORMAT_ID = "darwish-medbbc.qbank-export";

export type ExportFormat = "aidoc" | "json" | "markdown" | "zip";

type QuestionChoice = { key: string; text: string };

type QuestionRow = {
  id: string;
  lesson_id?: string | null;
  topic_id?: string | null;
  kind?: string | null;
  difficulty?: string | null;
  stem: string;
  choices: QuestionChoice[] | null;
  answer_key: string;
  explanation?: string | null;
  tags?: string[] | null;
  ai_generated?: boolean | null;
  image_path?: string | null;
  image_caption?: string | null;
  created_at?: string | null;
  created_by?: string | null;
};

type EvidenceRow = {
  question_id: string;
  evidence_text: string;
  start_char?: number | null;
  end_char?: number | null;
  confidence?: number | null;
  source_document_id?: string | null;
};

type GeneratedRow = {
  question_id: string;
  exam_code?: string | null;
  subject_title?: string | null;
  topic_title?: string | null;
  generation_engine?: string | null;
  meta?: Record<string, unknown> | null;
};

type LessonRow = {
  id: string;
  title?: string | null;
  kind?: string | null;
  meta?: Record<string, unknown> | null;
};

type FlashcardRow = {
  id: string;
  lesson_id?: string | null;
  front: string;
  back: string;
  tags?: string[] | null;
  ai_generated?: boolean | null;
  created_at?: string | null;
};

type NoteRow = {
  id: string;
  lesson_id?: string | null;
  body: string;
  created_at?: string | null;
};

type ImageAsset = {
  ref: string;
  original_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sha1: string;
  data: Buffer;
  external_url?: string;
};

const EXAM_PATTERNS = [/^ifom/i, /^usmle/i, /^plab/i, /^amc/i, /^smle/i, /^dha/i, /^haad/i, /^qchp/i, /^prometric/i];
const DIFFICULTY_PATTERNS = [/^foundation$/i, /^intermediate$/i, /^advanced$/i, /^expert$/i];
const HIGH_YIELD_PATTERNS = [/high/i, /yield/i, /must/i, /pearl/i, /core/i];

function splitExplanation(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { explanation: "", educational_objective: "" };
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "",
    educational_objective: (parts[1] || "").trim(),
  };
}

function classifyTags(tags: string[] | null | undefined) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  const exams = list.filter((tag) => EXAM_PATTERNS.some((rx) => rx.test(tag)));
  const difficulty = list.filter((tag) => DIFFICULTY_PATTERNS.some((rx) => rx.test(tag)));
  const semantic = list.filter((tag) => !EXAM_PATTERNS.some((rx) => rx.test(tag)) && !DIFFICULTY_PATTERNS.some((rx) => rx.test(tag)));
  const high_yield = list.filter((tag) => HIGH_YIELD_PATTERNS.some((rx) => rx.test(tag)));
  return {
    exams,
    difficulty,
    subject: semantic[0] || "",
    system: semantic[1] || semantic[0] || "",
    topic: semantic[2] || semantic[1] || semantic[0] || "",
    high_yield,
    raw_tags: list,
    semantic,
  };
}

function inferContentType(pathName: string) {
  const lower = pathName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "application/octet-stream";
}

function extFromContentType(contentType: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("bmp")) return ".bmp";
  if (contentType.includes("tiff")) return ".tiff";
  return ".bin";
}

async function sha1Hex(data: Buffer) {
  const { createHash } = await import("node:crypto");
  return createHash("sha1").update(data).digest("hex");
}

function safeSlug(input: string, fallback = "asset") {
  const base = (input || fallback)
    .replace(/[^\p{L}\p{N}\-_.]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback;
}

async function loadRemoteImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || inferContentType(url);
    return { data: buffer, contentType };
  } catch {
    return null;
  }
}

function decodeDataUri(dataUri: string): { data: Buffer; contentType: string } | null {
  const match = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const payload = match[3] || "";
  const data = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  return { data, contentType };
}

async function fetchStorageImage(
  admin: ReturnType<typeof createAdminClient>,
  path: string
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const { data } = await admin.storage.from("lesson-assets").download(path);
    if (!data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = (data as any)?.type || inferContentType(path);
    return { data: buffer, contentType };
  } catch {
    return null;
  }
}

async function resolveImageAsset(
  admin: ReturnType<typeof createAdminClient>,
  question: QuestionRow,
  seenHashes: Map<string, ImageAsset>,
  nameCounts: Map<string, number>
): Promise<ImageAsset | null> {
  const raw = (question.image_path || "").trim();
  if (!raw) return null;

  let source: { data: Buffer; contentType: string } | null = null;
  let external_url: string | undefined;

  if (raw.startsWith("data:")) {
    source = decodeDataUri(raw);
  } else if (/^https?:\/\//i.test(raw)) {
    source = await loadRemoteImage(raw);
    external_url = raw;
  } else if (raw.startsWith("/")) {
    external_url = raw;
    source = null;
  } else {
    source = await fetchStorageImage(admin, raw);
  }

  if (!source) {
    return {
      ref: `image-${question.id}`,
      original_path: raw,
      file_name: `question-${question.id}${extFromContentType(inferContentType(raw))}`,
      content_type: inferContentType(raw),
      size_bytes: 0,
      sha1: "",
      data: Buffer.alloc(0),
      external_url: external_url || raw,
    };
  }

  const sha = await sha1Hex(source.data);
  const dedup = seenHashes.get(sha);
  if (dedup) return dedup;

  const suggested = safeSlug(raw.split("/").pop() || `question-${question.id}`, `question-${question.id}`);
  const ext = extFromContentType(source.contentType);
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(suggested);
  let fileName = hasExt ? suggested : `${suggested}${ext}`;
  const key = fileName.toLowerCase();
  const count = (nameCounts.get(key) || 0) + 1;
  nameCounts.set(key, count);
  if (count > 1) {
    const dot = fileName.lastIndexOf(".");
    if (dot > 0) fileName = `${fileName.slice(0, dot)}-${count}${fileName.slice(dot)}`;
    else fileName = `${fileName}-${count}`;
  }

  const asset: ImageAsset = {
    ref: `image-${sha.slice(0, 12)}`,
    original_path: raw,
    file_name: fileName,
    content_type: source.contentType,
    size_bytes: source.data.length,
    sha1: sha,
    data: source.data,
    external_url,
  };
  seenHashes.set(sha, asset);
  return asset;
}

export type ExportedQuestion = {
  id: string;
  order_index: number;
  stem_markdown: string;
  stem_plaintext: string;
  choices: QuestionChoice[];
  answer_key: string;
  explanation: string;
  educational_objective: string;
  subject: string;
  system: string;
  topic: string;
  difficulty: string;
  exam_codes: string[];
  high_yield_tags: string[];
  all_tags: string[];
  image: {
    ref: string;
    file_name: string;
    original_path: string;
    content_type: string;
    size_bytes: number;
    sha1: string;
    caption: string;
    external_url?: string;
    position: "before_stem" | "inline_stem" | "after_stem";
  } | null;
  tables: string[];
  figure_captions: string[];
  image_references: string[];
  notes: NoteRow[];
  highlights: string[];
  flashcards: FlashcardRow[];
  evidence: EvidenceRow[];
  generation: GeneratedRow[];
  lesson: LessonRow | null;
  metadata: {
    kind: string;
    ai_generated: boolean;
    created_at: string | null;
    created_by: string | null;
    lesson_id: string | null;
    topic_id: string | null;
  };
};

export type ExportManifest = {
  format: typeof EXPORT_FORMAT_ID;
  schema_version: typeof EXPORT_SCHEMA_VERSION;
  exported_at: string;
  export_notes: string;
  totals: {
    questions: number;
    images: number;
    flashcards: number;
    notes: number;
    lessons: number;
  };
  images: Array<{
    ref: string;
    file_name: string;
    original_path: string;
    content_type: string;
    size_bytes: number;
    sha1: string;
    external_url?: string;
  }>;
  questions: ExportedQuestion[];
};

function extractTablesFromExplanation(text: string): string[] {
  if (!text) return [];
  const tableBlocks: string[] = [];
  const lines = text.split(/\n/);
  let buffer: string[] = [];
  for (const line of lines) {
    if (/\|.+\|/.test(line)) {
      buffer.push(line);
    } else if (buffer.length) {
      if (buffer.length >= 2) tableBlocks.push(buffer.join("\n"));
      buffer = [];
    }
  }
  if (buffer.length >= 2) tableBlocks.push(buffer.join("\n"));
  return tableBlocks;
}

function extractFigureCaptions(text: string): string[] {
  if (!text) return [];
  const captions: string[] = [];
  const matches = text.matchAll(/(?:^|\n)\s*(Figure|Fig\.?|Image|Table)\s*\d*\s*[:\-\.]\s*([^\n]+)/gi);
  for (const match of matches) captions.push(`${match[1]}: ${match[2].trim()}`);
  return captions;
}

function extractImageReferences(text: string): string[] {
  if (!text) return [];
  const refs: string[] = [];
  const linkMatches = text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of linkMatches) refs.push(match[1]);
  const htmlMatches = text.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi);
  for (const match of htmlMatches) refs.push(match[1]);
  return refs;
}

function extractHighlights(text: string): string[] {
  if (!text) return [];
  const highlights: string[] = [];
  const boldMatches = text.matchAll(/\*\*([^*]+)\*\*/g);
  for (const match of boldMatches) highlights.push(match[1].trim());
  const markMatches = text.matchAll(/<mark[^>]*>([\s\S]*?)<\/mark>/gi);
  for (const match of markMatches) highlights.push(match[1].replace(/<[^>]+>/g, "").trim());
  return highlights.filter(Boolean);
}

function normalizeChoices(input: unknown): QuestionChoice[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (item && typeof item === "object") {
          const key = String((item as any).key ?? (item as any).id ?? "").trim();
          const text = String((item as any).text ?? (item as any).value ?? "").trim();
          if (!key || !text) return null;
          return { key, text };
        }
        return null;
      })
      .filter(Boolean) as QuestionChoice[];
  }
  return [];
}

export async function collectExportData(options: {
  questionIds?: string[];
  lessonId?: string;
  includeFlashcards?: boolean;
  includeNotes?: boolean;
}) {
  const admin = createAdminClient();

  let query = admin
    .from("questions")
    .select("id, lesson_id, topic_id, kind, difficulty, stem, choices, answer_key, explanation, tags, ai_generated, image_path, image_caption, created_at, created_by")
    .order("created_at", { ascending: true });

  if (options.questionIds?.length) query = query.in("id", options.questionIds);
  if (options.lessonId) query = query.eq("lesson_id", options.lessonId);

  const { data: questionRows, error } = await query;
  if (error) throw new Error(error.message);
  const questions = (questionRows || []) as QuestionRow[];
  const questionIds = questions.map((q) => q.id);
  const lessonIds = Array.from(new Set(questions.map((q) => q.lesson_id).filter((x): x is string => !!x)));

  const [evidenceRes, generatedRes, lessonRes, flashRes, notesRes] = await Promise.all([
    questionIds.length
      ? admin.from("question_evidence").select("question_id, evidence_text, start_char, end_char, confidence, source_document_id").in("question_id", questionIds)
      : Promise.resolve({ data: [], error: null } as any),
    questionIds.length
      ? admin.from("generated_questions").select("question_id, exam_code, subject_title, topic_title, generation_engine, meta").in("question_id", questionIds)
      : Promise.resolve({ data: [], error: null } as any),
    lessonIds.length
      ? admin.from("lessons").select("id, title, kind, meta").in("id", lessonIds)
      : Promise.resolve({ data: [], error: null } as any),
    options.includeFlashcards && lessonIds.length
      ? admin.from("flashcards").select("id, lesson_id, front, back, tags, ai_generated, created_at").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null } as any),
    options.includeNotes && lessonIds.length
      ? admin.from("notes").select("id, lesson_id, body, created_at").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const evidenceByQuestion = new Map<string, EvidenceRow[]>();
  for (const row of (evidenceRes.data || []) as EvidenceRow[]) {
    const list = evidenceByQuestion.get(row.question_id) || [];
    list.push(row);
    evidenceByQuestion.set(row.question_id, list);
  }

  const generationByQuestion = new Map<string, GeneratedRow[]>();
  for (const row of (generatedRes.data || []) as GeneratedRow[]) {
    const list = generationByQuestion.get(row.question_id) || [];
    list.push(row);
    generationByQuestion.set(row.question_id, list);
  }

  const lessonsById = new Map<string, LessonRow>();
  for (const lesson of (lessonRes.data || []) as LessonRow[]) lessonsById.set(lesson.id, lesson);

  const flashcardsByLesson = new Map<string, FlashcardRow[]>();
  for (const flash of (flashRes.data || []) as FlashcardRow[]) {
    if (!flash.lesson_id) continue;
    const list = flashcardsByLesson.get(flash.lesson_id) || [];
    list.push(flash);
    flashcardsByLesson.set(flash.lesson_id, list);
  }

  const notesByLesson = new Map<string, NoteRow[]>();
  for (const note of (notesRes.data || []) as NoteRow[]) {
    if (!note.lesson_id) continue;
    const list = notesByLesson.get(note.lesson_id) || [];
    list.push(note);
    notesByLesson.set(note.lesson_id, list);
  }

  const imageSeen = new Map<string, ImageAsset>();
  const nameCounts = new Map<string, number>();
  const exportedQuestions: ExportedQuestion[] = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const parsedExplanation = splitExplanation(question.explanation);
    const classified = classifyTags(question.tags);
    const generation = generationByQuestion.get(question.id) || [];
    const image = await resolveImageAsset(admin, question, imageSeen, nameCounts);
    const explanationText = parsedExplanation.explanation;
    const lesson = question.lesson_id ? lessonsById.get(question.lesson_id) ?? null : null;

    const subject = generation[0]?.subject_title || classified.subject;
    const topic = generation[0]?.topic_title || classified.topic;
    const system = (generation[0]?.meta as any)?.system || classified.system;
    const educationalObjective = parsedExplanation.educational_objective || String((generation[0]?.meta as any)?.educational_objective || "").trim();

    exportedQuestions.push({
      id: question.id,
      order_index: index + 1,
      stem_markdown: question.stem,
      stem_plaintext: question.stem.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      choices: normalizeChoices(question.choices),
      answer_key: question.answer_key,
      explanation: explanationText,
      educational_objective: educationalObjective,
      subject,
      system,
      topic,
      difficulty: question.difficulty || classified.difficulty[0] || "intermediate",
      exam_codes: classified.exams,
      high_yield_tags: classified.high_yield,
      all_tags: classified.raw_tags,
      image: image
        ? {
            ref: image.ref,
            file_name: image.file_name,
            original_path: image.original_path,
            content_type: image.content_type,
            size_bytes: image.size_bytes,
            sha1: image.sha1,
            caption: question.image_caption || "",
            external_url: image.external_url,
            position: "before_stem",
          }
        : null,
      tables: extractTablesFromExplanation(`${question.stem}\n${explanationText}`),
      figure_captions: extractFigureCaptions(`${question.stem}\n${explanationText}`),
      image_references: extractImageReferences(`${question.stem}\n${explanationText}`),
      notes: question.lesson_id ? notesByLesson.get(question.lesson_id) || [] : [],
      highlights: extractHighlights(`${question.stem}\n${explanationText}`),
      flashcards: question.lesson_id ? flashcardsByLesson.get(question.lesson_id) || [] : [],
      evidence: evidenceByQuestion.get(question.id) || [],
      generation,
      lesson,
      metadata: {
        kind: question.kind || "sba",
        ai_generated: !!question.ai_generated,
        created_at: question.created_at || null,
        created_by: question.created_by || null,
        lesson_id: question.lesson_id || null,
        topic_id: question.topic_id || null,
      },
    });
  }

  const images = Array.from(imageSeen.values());
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT_ID,
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    export_notes:
      "Self-contained export of medical questions. Images are stored as separate binary files under images/ and referenced from each question via image.ref / image.file_name. Do not re-encode the image binaries.",
    totals: {
      questions: exportedQuestions.length,
      images: images.length,
      flashcards: exportedQuestions.reduce((sum, q) => sum + q.flashcards.length, 0),
      notes: exportedQuestions.reduce((sum, q) => sum + q.notes.length, 0),
      lessons: new Set(exportedQuestions.map((q) => q.metadata.lesson_id).filter(Boolean)).size,
    },
    images: images.map((image) => ({
      ref: image.ref,
      file_name: image.file_name,
      original_path: image.original_path,
      content_type: image.content_type,
      size_bytes: image.size_bytes,
      sha1: image.sha1,
      external_url: image.external_url,
    })),
    questions: exportedQuestions,
  };

  return { manifest, images };
}

function renderQuestionMarkdown(question: ExportedQuestion): string {
  const lines: string[] = [];
  lines.push(`## Question ${question.order_index}`);
  lines.push("");
  if (question.image) {
    lines.push(`![${question.image.caption || "Medical image"}](images/${question.image.file_name})`);
    if (question.image.caption) lines.push(`*${question.image.caption}*`);
    lines.push("");
  }
  lines.push(question.stem_markdown);
  lines.push("");
  lines.push("### Answer choices");
  for (const choice of question.choices) lines.push(`- **${choice.key}.** ${choice.text}`);
  lines.push("");
  lines.push(`**Correct answer:** ${question.answer_key}`);
  lines.push("");
  if (question.explanation) {
    lines.push("### Explanation");
    lines.push(question.explanation);
    lines.push("");
  }
  if (question.educational_objective) {
    lines.push("### Educational objective");
    lines.push(question.educational_objective);
    lines.push("");
  }
  lines.push("### Classification");
  lines.push(`- Subject: ${question.subject || "—"}`);
  lines.push(`- System: ${question.system || "—"}`);
  lines.push(`- Topic: ${question.topic || "—"}`);
  lines.push(`- Difficulty: ${question.difficulty}`);
  if (question.high_yield_tags.length) lines.push(`- High-yield tags: ${question.high_yield_tags.join(", ")}`);
  if (question.all_tags.length) lines.push(`- Tags: ${question.all_tags.join(", ")}`);
  lines.push("");
  if (question.figure_captions.length) {
    lines.push("### Figure captions");
    for (const cap of question.figure_captions) lines.push(`- ${cap}`);
    lines.push("");
  }
  if (question.tables.length) {
    lines.push("### Tables");
    for (const table of question.tables) {
      lines.push(table);
      lines.push("");
    }
  }
  if (question.image_references.length) {
    lines.push("### Image references");
    for (const ref of question.image_references) lines.push(`- ${ref}`);
    lines.push("");
  }
  if (question.highlights.length) {
    lines.push("### Highlights");
    for (const hi of question.highlights) lines.push(`- ${hi}`);
    lines.push("");
  }
  if (question.notes.length) {
    lines.push("### Notes");
    for (const note of question.notes) lines.push(`- ${note.body}`);
    lines.push("");
  }
  if (question.flashcards.length) {
    lines.push("### Flashcards");
    for (const flash of question.flashcards) {
      lines.push(`- **${flash.front}** — ${flash.back}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function renderMarkdownIndex(manifest: ExportManifest): string {
  const lines: string[] = [];
  lines.push(`# Darwish MedBBC — Question Bank Export`);
  lines.push("");
  lines.push(`- Format: \`${manifest.format}\``);
  lines.push(`- Schema version: \`${manifest.schema_version}\``);
  lines.push(`- Exported at: ${manifest.exported_at}`);
  lines.push(`- Total questions: ${manifest.totals.questions}`);
  lines.push(`- Total images: ${manifest.totals.images}`);
  lines.push(`- Total flashcards: ${manifest.totals.flashcards}`);
  lines.push(`- Total notes: ${manifest.totals.notes}`);
  lines.push("");
  lines.push("> Images live under `images/` in their original resolution. Do not compress or re-encode them.");
  lines.push("");
  for (const question of manifest.questions) lines.push(renderQuestionMarkdown(question));
  return lines.join("\n");
}

export function buildJsonBuffer(manifest: ExportManifest): Buffer {
  return Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
}

export function buildAiDocBuffer(manifest: ExportManifest, images: ImageAsset[]): Buffer {
  const entries: Array<{ name: string; data: Buffer | string; compress?: boolean }> = [
    { name: "aidoc.json", data: JSON.stringify({ format: manifest.format, schema_version: manifest.schema_version, exported_at: manifest.exported_at, totals: manifest.totals }, null, 2) },
    { name: "manifest.json", data: buildJsonBuffer(manifest) },
    { name: "questions.md", data: renderMarkdownIndex(manifest) },
  ];
  for (const image of images) {
    if (!image.data.length) continue;
    entries.push({ name: `images/${image.file_name}`, data: image.data, compress: false });
  }
  return buildZip(entries);
}

export function buildMarkdownPackageBuffer(manifest: ExportManifest, images: ImageAsset[]): Buffer {
  const entries: Array<{ name: string; data: Buffer | string; compress?: boolean }> = [
    { name: "README.md", data: renderMarkdownIndex(manifest) },
    { name: "manifest.json", data: buildJsonBuffer(manifest) },
  ];
  for (const image of images) {
    if (!image.data.length) continue;
    entries.push({ name: `images/${image.file_name}`, data: image.data, compress: false });
  }
  return buildZip(entries);
}

export function buildZipBundleBuffer(manifest: ExportManifest, images: ImageAsset[]): Buffer {
  const entries: Array<{ name: string; data: Buffer | string; compress?: boolean }> = [
    { name: "manifest.json", data: buildJsonBuffer(manifest) },
  ];
  for (const image of images) {
    if (!image.data.length) continue;
    entries.push({ name: `images/${image.file_name}`, data: image.data, compress: false });
  }
  return buildZip(entries);
}

export function contentTypeForFormat(format: ExportFormat) {
  switch (format) {
    case "json":
      return "application/json";
    case "markdown":
      return "application/zip";
    case "zip":
      return "application/zip";
    case "aidoc":
    default:
      return "application/vnd.darwish.aidoc+zip";
  }
}

export function extensionForFormat(format: ExportFormat) {
  switch (format) {
    case "json":
      return "json";
    case "markdown":
      return "md.zip";
    case "zip":
      return "zip";
    case "aidoc":
    default:
      return "aidoc";
  }
}

export async function buildQuestionExport(options: {
  format: ExportFormat;
  questionIds?: string[];
  lessonId?: string;
  includeFlashcards?: boolean;
  includeNotes?: boolean;
}) {
  const { manifest, images } = await collectExportData({
    questionIds: options.questionIds,
    lessonId: options.lessonId,
    includeFlashcards: options.includeFlashcards ?? true,
    includeNotes: options.includeNotes ?? true,
  });

  const format = options.format;
  let body: Buffer;
  switch (format) {
    case "json":
      body = buildJsonBuffer(manifest);
      break;
    case "markdown":
      body = buildMarkdownPackageBuffer(manifest, images);
      break;
    case "zip":
      body = buildZipBundleBuffer(manifest, images);
      break;
    case "aidoc":
    default:
      body = buildAiDocBuffer(manifest, images);
      break;
  }

  return {
    body,
    manifest,
    contentType: contentTypeForFormat(format),
    extension: extensionForFormat(format),
  };
}
