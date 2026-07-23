import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { indexSource } from "@/lib/ai/rag";
import { extractLessonIndexText, safeMeta } from "@/lib/ai/source-text";

function inferExtFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "html";
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
  const mergedMeta = { ...meta, ...(index_text ? { index_text } : {}) };

  if (kind === "html-inline") {
    const html = String(fd.get("html") || "");
    if (!html.trim()) return NextResponse.json({ error: "html required" }, { status: 400 });
    row = { ...row, kind: "html", html_body: html, meta: mergedMeta };
    indexText = extractLessonIndexText({ kind: "html", html_body: html, meta: mergedMeta });
  } else if (preUploadedPath) {
    const inferredKind = kind === "pdf" ? "pdf" : inferExtFromPath(preUploadedPath);
    row = { ...row, kind: inferredKind, storage_path: preUploadedPath, meta: mergedMeta };

    if (inferredKind === "html") {
      const { data } = await admin.storage.from("lesson-assets").download(preUploadedPath);
      const uploadedHtml = data ? await data.text() : "";
      indexText = extractLessonIndexText({ kind: inferredKind, meta: mergedMeta }, uploadedHtml);
    } else {
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

    row = {
      ...row,
      kind: ext,
      storage_path: path,
      meta: { ...mergedMeta, original_name: file.name, file_size: file.size },
    };
    const uploadedHtml = ext === "html" ? bytes.toString("utf-8") : "";
    indexText = extractLessonIndexText({ kind: ext, meta: row.meta as Record<string, unknown> }, uploadedHtml);
  }

  const { data: lesson, error } = await admin.from("lessons").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (indexText) {
    try {
      await indexSource("lesson", lesson.id, indexText);
    } catch {
      // keep document creation non-blocking
    }
  }

  return NextResponse.json({ lesson });
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
      if (text) await indexSource("lesson", id, text);
    } catch {
      // ignore reindex errors on patch
    }
  }

  return NextResponse.json({ lesson: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id")!;
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("storage_path").eq("id", id).single();
  if (lesson?.storage_path) await admin.storage.from("lesson-assets").remove([lesson.storage_path]);
  await admin.from("lessons").delete().eq("id", id);
  await admin.from("rag_chunks").delete().eq("source_type", "lesson").eq("source_id", id);
  return NextResponse.json({ ok: true });
}
