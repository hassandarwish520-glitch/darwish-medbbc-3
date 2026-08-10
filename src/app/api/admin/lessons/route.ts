import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { indexSource } from "@/lib/ai/rag";
import { extractPdfTextFromBuffer } from "@/lib/ai/pdf";
import { extractLessonIndexText, extractQuestionIndexText, safeMeta } from "@/lib/ai/source-text";
import { extractQuestionsFromImportedSource } from "@/lib/ai/question-import";
import { detectIfomSubject, detectTopic } from "@/lib/ai/ifom";

function inferExtFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "pptx";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".gif")) return "image";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "html";
}

type LessonRow = {
  id: string;
  title: string;
  kind: string;
  html_body?: string | null;
  storage_path?: string | null;
  meta?: Record<string, unknown> | null;
};

async function loadLessonSource(lesson: LessonRow, admin: ReturnType<typeof createAdminClient>) {
  let rawText = extractLessonIndexText(lesson);
  let rawHtml = "";

  if (lesson.kind === "html" && lesson.html_body) {
    rawHtml = lesson.html_body;
    rawText = rawText || lesson.html_body;
    return { rawText, rawHtml };
  }

  if (!lesson.storage_path) return { rawText, rawHtml };

  const { data: blob } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
  if (!blob) return { rawText, rawHtml };

  if (lesson.kind === "html") {
    rawHtml = await blob.text();
    rawText = extractLessonIndexText(lesson, rawHtml) || rawHtml;
  } else if (lesson.kind === "pdf") {
    const pdfText = await extractPdfTextFromBuffer(Buffer.from(await blob.arrayBuffer()));
    rawText = extractLessonIndexText({ ...lesson, meta: { ...(lesson.meta ?? {}), extracted_text: pdfText } });
  }

  return { rawText, rawHtml };
}

async function deleteLessonQuestions(lessonId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: existingQuestions } = await admin.from("questions").select("id").eq("lesson_id", lessonId);
  const ids = (existingQuestions ?? []).map((row: any) => row.id).filter(Boolean);
  if (!ids.length) return;
  await admin.from("questions").delete().in("id", ids);
  await admin.from("rag_chunks").delete().eq("source_type", "question").in("source_id", ids);
}

async function autoImportQbankQuestions(lesson: LessonRow, admin: ReturnType<typeof createAdminClient>, userId: string) {
  const meta = (lesson.meta ?? {}) as Record<string, unknown>;
  const section = typeof meta.section === "string" ? meta.section.trim() : "";
  const skipAutoImport = meta.skip_auto_import === true;

  if (section !== "qbank") {
    await deleteLessonQuestions(lesson.id, admin);
    return { inserted: 0, subject: typeof meta.subject === "string" ? meta.subject : null, topic: null as string | null };
  }

  // When skip_auto_import is set, the caller handles question extraction externally (e.g. via /api/admin/qbank/import).
  // Do not delete or re-import — just return the current count.
  if (skipAutoImport) {
    const { count } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", lesson.id);
    return { inserted: count ?? 0, subject: typeof meta.subject === "string" ? meta.subject : null, topic: null as string | null };
  }

  const { rawText, rawHtml } = await loadLessonSource(lesson, admin);
  await deleteLessonQuestions(lesson.id, admin);
  if (!rawText.trim() && !rawHtml.trim()) {
    return { inserted: 0, subject: typeof meta.subject === "string" ? meta.subject : null, topic: null as string | null };
  }

  const subject = typeof meta.subject === "string" && meta.subject.trim() ? meta.subject.trim() : detectIfomSubject(rawText || lesson.title);
  const topic = typeof meta.topic === "string" && meta.topic.trim() ? meta.topic.trim() : detectTopic(rawText || lesson.title, subject);
  const extracted = extractQuestionsFromImportedSource(rawText, {
    preferredDifficulty: "intermediate",
    count: 500,
    lessonId: lesson.id,
    rawHtml,
  });

  if (!extracted.length) return { inserted: 0, subject, topic };

  const rows = extracted.map((q) => ({
    lesson_id: lesson.id,
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: q.explanation,
    difficulty: q.difficulty || "intermediate",
    tags: Array.from(new Set([subject, q.system || subject, q.topic || topic, ...(q.tags ?? [])].filter(Boolean))),
    image_path: q.image_path || null,
    image_caption: q.image_caption || null,
    ai_generated: false,
    created_by: userId,
  }));

  const { data: inserted, error } = await admin.from("questions").insert(rows).select();
  if (error) throw error;

  await Promise.all(
    (inserted ?? []).map(async (row: any) => {
      const indexText = extractQuestionIndexText(row);
      if (indexText) {
        try {
          await indexSource("question", row.id, indexText);
        } catch {}
      }
    }),
  );

  return { inserted: inserted?.length ?? rows.length, subject, topic };
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const fd = await req.formData();
  const title = String(fd.get("title") || "").trim();
  const course_id = String(fd.get("course_id") || "") || null;
  const kind = String(fd.get("kind") || "");
  const index_text = String(fd.get("index_text") || "").trim();
  const meta = safeMeta(fd.get("meta"));
  const preUploadedPath = String(fd.get("storage_path") || "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const admin = createAdminClient();
  let row: Record<string, unknown> = { title, course_id, created_by: ctx.user.id, visible: true };
  let indexText = "";
  const mergedMeta = { ...meta, ...(index_text ? { index_text } : {}) } as Record<string, unknown>;

  const isVideo = mergedMeta?.type === "video" && typeof mergedMeta?.url === "string";
  if (isVideo) {
    const normalizedUrl = String(mergedMeta.url).trim();
    const { data: existingVideo } = await admin
      .from("lessons")
      .select("*")
      .eq("kind", "html")
      .contains("meta", { type: "video", url: normalizedUrl })
      .maybeSingle();

    if (existingVideo) return NextResponse.json({ lesson: existingVideo, deduped: true });
  }

  if (kind === "html-inline") {
    const html = String(fd.get("html") || "");
    if (!html.trim()) return NextResponse.json({ error: "html required" }, { status: 400 });
    row = { ...row, kind: "html", html_body: html, meta: mergedMeta };
    indexText = extractLessonIndexText({ kind: "html", html_body: html, meta: mergedMeta });
  } else if (preUploadedPath) {
    // "pptx" and "image" are not in the DB enum — store as "pdf" and record file_type in meta
    const rawKind = ["pdf", "pptx", "image"].includes(kind) ? kind : kind === "html-file" ? inferExtFromPath(preUploadedPath) : inferExtFromPath(preUploadedPath);
    const dbKind = (rawKind === "pptx" || rawKind === "image") ? "pdf" : rawKind;
    const fileTypeMeta = (rawKind === "pptx" || rawKind === "image") ? { file_type: rawKind } : {};
    const inferredKind = dbKind;
    row = { ...row, kind: inferredKind, storage_path: preUploadedPath, meta: { ...mergedMeta, ...fileTypeMeta } };

    if (inferredKind === "html") {
      const { data } = await admin.storage.from("lesson-assets").download(preUploadedPath);
      const uploadedHtml = data ? await data.text() : "";
      indexText = extractLessonIndexText({ kind: inferredKind, meta: mergedMeta }, uploadedHtml);
    } else if (inferredKind === "pdf") {
      const { data } = await admin.storage.from("lesson-assets").download(preUploadedPath);
      const pdfText = data ? await extractPdfTextFromBuffer(Buffer.from(await data.arrayBuffer())) : "";
      indexText = extractLessonIndexText({ kind: inferredKind, meta: { ...mergedMeta, extracted_text: pdfText } });
    } else {
      // pptx, image, and other binary kinds: no text extraction, just store metadata
      indexText = extractLessonIndexText({ kind: inferredKind, meta: mergedMeta });
    }
  } else {
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = kind === "pdf" ? "pdf" : "html";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("lesson-assets")
      .upload(path, bytes, { contentType: file.type || (ext === "pdf" ? "application/pdf" : "text/html") });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    row = { ...row, kind: ext, storage_path: path, meta: { ...mergedMeta, original_name: file.name, file_size: file.size } };
    const uploadedHtml = ext === "html" ? bytes.toString("utf-8") : "";
    const pdfText = ext === "pdf" ? await extractPdfTextFromBuffer(bytes) : "";
    indexText = extractLessonIndexText({ kind: ext, meta: { ...(row.meta as Record<string, unknown>), ...(pdfText ? { extracted_text: pdfText } : {}) } }, uploadedHtml);
    if (pdfText) row = { ...row, meta: { ...(row.meta as Record<string, unknown>), extracted_text: pdfText } };
  }

  const { data: lesson, error } = await admin.from("lessons").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (indexText) {
    try {
      await indexSource("lesson", lesson.id, indexText);
    } catch {}
  }

  let imported = { inserted: 0, subject: null as string | null, topic: null as string | null };
  try {
    imported = await autoImportQbankQuestions(lesson as LessonRow, admin, ctx.user.id);
  } catch {}

  revalidateTag("subject-base-data");
  return NextResponse.json({ lesson, imported });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, ...patch } = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("lessons").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data && (Object.prototype.hasOwnProperty.call(patch, "meta") || Object.prototype.hasOwnProperty.call(patch, "html_body"))) {
    try {
      await admin.from("rag_chunks").delete().eq("source_type", "lesson").eq("source_id", id);
      let text = extractLessonIndexText(data);
      if (!text && data.storage_path && data.kind === "html") {
        const { data: blob } = await admin.storage.from("lesson-assets").download(data.storage_path);
        text = blob ? extractLessonIndexText(data, await blob.text()) : text;
      }
      if (!text && data.storage_path && data.kind === "pdf") {
        const { data: blob } = await admin.storage.from("lesson-assets").download(data.storage_path);
        const pdfText = blob ? await extractPdfTextFromBuffer(Buffer.from(await blob.arrayBuffer())) : "";
        text = extractLessonIndexText({ ...data, meta: { ...(data.meta ?? {}), ...(pdfText ? { extracted_text: pdfText } : {}) } });
      }
      if (text) await indexSource("lesson", id, text);
    } catch {}
  }

  let imported = { inserted: 0, subject: null as string | null, topic: null as string | null };
  try {
    imported = await autoImportQbankQuestions(data as LessonRow, admin, ctx.user.id);
  } catch {}

  revalidateTag("subject-base-data");
  return NextResponse.json({ lesson: data, imported });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  await deleteLessonQuestions(id, admin);
  const { data: lesson } = await admin.from("lessons").select("storage_path,meta").eq("id", id).single();
  const filesToRemove = [lesson?.storage_path, typeof lesson?.meta?.document_path === "string" ? lesson.meta.document_path : null].filter(Boolean) as string[];

  if (filesToRemove.length) {
    await admin.storage.from("lesson-assets").remove(filesToRemove).catch(() => undefined);
  }

  await Promise.all([
    admin.from("source_documents").delete().eq("lesson_id", id),
    admin.from("rag_chunks").delete().eq("source_type", "lesson").eq("source_id", id),
  ]);

  const { error } = await admin.from("lessons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
