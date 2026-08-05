// @ts-nocheck
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { SUBJECT_IMPORT_DOCUMENTS, type SubjectImportDocument } from "./import-manifest";

type QuestionRow = {
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string;
  image_path: string | null;
  image_caption: string | null;
  difficulty: string;
  tags: string[];
  subject: string;
  system: string;
  topic: string;
};

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  storage_path?: string | null;
  meta?: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  email: string;
  role: string;
  status: string;
};

type CliFlags = {
  dryRun: boolean;
  documentsOnly: boolean;
  questionsOnly: boolean;
  replace: boolean;
};

function parseFlags(argv: string[]): CliFlags {
  const args = new Set(argv);
  return {
    dryRun: args.has("--dry-run"),
    documentsOnly: args.has("--documents-only"),
    questionsOnly: args.has("--questions-only"),
    replace: args.has("--replace"),
  };
}

function mustEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for a real import run`);
  return value;
}

function htmlToText(html: string) {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<\/\s*(?:p|div|li|h[1-6]|tr|blockquote|pre|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function guessContentType(filePath: string, kind: SubjectImportDocument["kind"]) {
  if (kind === "pdf") return "application/pdf";
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".htm") || lower.endsWith(".html")) return "text/html";
  return "application/octet-stream";
}

function cleanStorageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "file";
}

async function loadQuestions(bundlePath: string) {
  const text = await fs.readFile(bundlePath, "utf8");
  return JSON.parse(text) as QuestionRow[];
}

async function loadIndexText(entry: SubjectImportDocument) {
  const text = await fs.readFile(entry.localFilePath, entry.kind === "pdf" ? undefined : "utf8");
  if (typeof text === "string") return htmlToText(text).slice(0, 12000);
  return "";
}

async function resolveAdminProfileId(supabase: ReturnType<typeof createClient>) {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "hassandarwish520@gmail.com";
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,status")
    .eq("email", adminEmail)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  if (data?.id) return data.id;

  const fallback = await supabase
    .from("profiles")
    .select("id,email,role,status")
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1)
    .maybeSingle<ProfileRow>();
  if (fallback.error) throw fallback.error;
  if (!fallback.data?.id) throw new Error("No active admin profile found to stamp created_by");
  return fallback.data.id;
}

async function upsertDocumentLesson(supabase: ReturnType<typeof createClient>, createdBy: string, entry: SubjectImportDocument, flags: CliFlags) {
  const raw = await fs.readFile(entry.localFilePath);
  const indexText = await loadIndexText(entry);
  const storagePath = `subject-imports/${entry.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${Date.now()}-${cleanStorageName(entry.sourceFileName)}`;

  const { data: existing, error: lookupError } = await supabase
    .from("lessons")
    .select("id,title,kind,storage_path,meta")
    .eq("title", entry.lessonTitle)
    .maybeSingle<LessonRow>();
  if (lookupError) throw lookupError;

  if (flags.dryRun) {
    return { lessonId: existing?.id || `dry-${entry.key}`, action: existing ? "would-update" : "would-create", title: entry.lessonTitle, storagePath };
  }

  const { error: uploadError } = await supabase.storage.from("lesson-assets").upload(storagePath, raw, {
    contentType: guessContentType(entry.localFilePath, entry.kind),
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const meta = {
    subject: entry.subject,
    exam_code: entry.examCode,
    description: entry.description,
    original_name: entry.sourceFileName,
    source_type: "bulk-subject-import",
    import_key: entry.key,
    file_size: raw.byteLength,
    index_text: indexText,
    tags: entry.extraTags,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("lessons")
      .update({ kind: entry.kind, storage_path: storagePath, visible: true, meta: { ...(existing.meta || {}), ...meta } })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return { lessonId: data.id, action: "updated", title: entry.lessonTitle, storagePath };
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert({ title: entry.lessonTitle, kind: entry.kind, storage_path: storagePath, meta, visible: true, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return { lessonId: data.id, action: "created", title: entry.lessonTitle, storagePath };
}

async function deleteExistingQuestionsForLesson(supabase: ReturnType<typeof createClient>, lessonId: string) {
  const { data: existing, error: lookupError } = await supabase.from("questions").select("id").eq("lesson_id", lessonId);
  if (lookupError) throw lookupError;
  const ids = (existing || []).map((row) => row.id).filter(Boolean);
  if (!ids.length) return 0;
  await supabase.from("question_attempts").delete().in("question_id", ids);
  await supabase.from("question_evidence").delete().in("question_id", ids);
  await supabase.from("generated_questions").delete().in("question_id", ids);
  await supabase.from("rag_chunks").delete().eq("source_type", "question").in("source_id", ids);
  const { error } = await supabase.from("questions").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}

async function importQuestionsForEntry(supabase: ReturnType<typeof createClient>, createdBy: string, entry: SubjectImportDocument, lessonId: string, flags: CliFlags) {
  if (!entry.bundleFilePath) return { imported: 0, deleted: 0, title: entry.lessonTitle };
  const bundle = await loadQuestions(entry.bundleFilePath);
  const rows = bundle.map((item) => ({
    lesson_id: lessonId,
    stem: item.stem,
    choices: item.choices,
    answer_key: item.answer_key,
    explanation: item.explanation,
    difficulty: item.difficulty || "intermediate",
    tags: Array.from(new Set([...(item.tags || []), ...entry.extraTags, entry.subject, item.system, item.topic].filter(Boolean))),
    image_path: item.image_path || null,
    image_caption: item.image_caption || null,
    ai_generated: false,
    created_by: createdBy,
  }));

  if (flags.dryRun) return { imported: rows.length, deleted: 0, title: entry.lessonTitle };

  let deleted = 0;
  if (flags.replace) deleted = await deleteExistingQuestionsForLesson(supabase, lessonId);

  const chunkSize = 100;
  let imported = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("questions").insert(slice).select("id");
    if (error) throw error;
    imported += data?.length || slice.length;
  }
  return { imported, deleted, title: entry.lessonTitle };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const willDocuments = !flags.questionsOnly;
  const willQuestions = !flags.documentsOnly;

  if (flags.dryRun) {
    const preview = [] as Array<Record<string, unknown>>;
    for (const entry of SUBJECT_IMPORT_DOCUMENTS) {
      preview.push({
        lessonTitle: entry.lessonTitle,
        subject: entry.subject,
        sourceFile: entry.localFilePath,
        bundle: entry.bundleFilePath || null,
        questionCount: entry.bundleFilePath ? (await loadQuestions(entry.bundleFilePath)).length : 0,
      });
    }
    console.log(JSON.stringify({ mode: "dry-run", willDocuments, willQuestions, replace: flags.replace, preview }, null, 2));
    return;
  }

  const supabase = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const createdBy = await resolveAdminProfileId(supabase);

  const lessonMap = new Map<string, string>();
  const documentResults: Array<Record<string, unknown>> = [];
  const questionResults: Array<Record<string, unknown>> = [];

  for (const entry of SUBJECT_IMPORT_DOCUMENTS) {
    if (willDocuments) {
      const result = await upsertDocumentLesson(supabase, createdBy, entry, flags);
      lessonMap.set(entry.key, result.lessonId);
      documentResults.push(result);
    } else {
      const { data: lesson } = await supabase.from("lessons").select("id").eq("title", entry.lessonTitle).maybeSingle<{ id: string }>();
      if (!lesson?.id) throw new Error(`Lesson not found for ${entry.lessonTitle}. Run the document import first.`);
      lessonMap.set(entry.key, lesson.id);
    }
  }

  if (willQuestions) {
    for (const entry of SUBJECT_IMPORT_DOCUMENTS.filter((item) => item.bundleFilePath)) {
      const lessonId = lessonMap.get(entry.key);
      if (!lessonId) throw new Error(`Missing lesson id for ${entry.lessonTitle}`);
      const result = await importQuestionsForEntry(supabase, createdBy, entry, lessonId, flags);
      questionResults.push(result);
    }
  }

  console.log(JSON.stringify({ mode: "real-run", replace: flags.replace, documents: documentResults, questions: questionResults }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
