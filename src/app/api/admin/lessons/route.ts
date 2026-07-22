import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";
import { indexSource } from "@/lib/ai/rag";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const fd = await req.formData();
  const title = String(fd.get("title") || "").trim();
  const course_id = String(fd.get("course_id") || "") || null;
  const kind = String(fd.get("kind"));
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const admin = createAdminClient();
  let row: any = { title, course_id, created_by: ctx.user.id, visible: true };
  let indexText = "";

  if (kind === "html-inline") {
    const html = String(fd.get("html") || "");
    row = { ...row, kind: "html", html_body: html };
    indexText = html.replace(/<[^>]+>/g, " ");
  } else {
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = kind === "pdf" ? "pdf" : "html";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("lesson-assets")
      .upload(path, bytes, { contentType: file.type || (ext==="pdf" ? "application/pdf" : "text/html") });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    row = { ...row, kind: ext === "pdf" ? "pdf" : "html", storage_path: path };
    if (ext === "html") indexText = bytes.toString("utf-8").replace(/<[^>]+>/g, " ");
  }

  const { data: lesson, error } = await admin.from("lessons").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort RAG indexing (non-blocking failure)
  if (indexText) { try { await indexSource("lesson", lesson.id, indexText); } catch {} }

  return NextResponse.json({ lesson });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, ...patch } = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("lessons").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id")!;
  const admin = createAdminClient();
  const { data: l } = await admin.from("lessons").select("storage_path").eq("id", id).single();
  if (l?.storage_path) await admin.storage.from("lesson-assets").remove([l.storage_path]);
  await admin.from("lessons").delete().eq("id", id);
  await admin.from("rag_chunks").delete().eq("source_type","lesson").eq("source_id", id);
  return NextResponse.json({ ok: true });
}
