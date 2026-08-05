import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, requireActive } from "@/lib/supabase/server";
import { extractNoteIndexText } from "@/lib/ai/source-text";
import { indexSource } from "@/lib/ai/rag";

export const runtime = "nodejs";

/** GET /api/notes — returns all notes for the user (or filtered by lesson_id) */
export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lesson_id");

  const db = await createClient();
  let query = db
    .from("notes")
    .select("id, lesson_id, body, meta, updated_at, created_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false });

  if (lessonId) {
    query = query.eq("lesson_id", lessonId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

/** POST /api/notes — create or update a note.
 *  lesson_id is optional — omit for standalone notes.
 *  Pass id to update an existing note.
 *  title is stored inside meta.title (no schema change needed).
 */
export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, lesson_id, title, body, meta: extraMeta } = await req.json();

  const db = await createClient();
  const admin = createAdminClient();
  const trimmed = typeof body === "string" ? body.trim() : "";

  if (!trimmed) {
    return NextResponse.json({ error: "Note body cannot be empty" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const meta: Record<string, unknown> = {
    ...(typeof extraMeta === "object" && extraMeta ? extraMeta : {}),
  };
  if (title && typeof title === "string" && title.trim()) {
    meta.title = title.trim();
  }

  // Update existing note by id
  if (id) {
    const updatePayload: Record<string, unknown> = {
      body: trimmed,
      meta,
      updated_at: now,
    };
    // Allow re-attaching (or detaching) a note to a lesson on update
    if (lesson_id !== undefined) {
      updatePayload.lesson_id = lesson_id || null;
    }

    const { data, error } = await db
      .from("notes")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .select("id, lesson_id, body, meta, updated_at, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await admin.from("rag_chunks").delete().eq("source_type", "note").eq("source_id", data.id);
      const text = extractNoteIndexText({ body: data.body });
      if (text) await indexSource("note", data.id, text);
    } catch { /* non-blocking */ }

    return NextResponse.json({ note: { ...data, title: data.meta?.title ?? null } });
  }

  // Create new standalone or lesson-linked note
  const payload: Record<string, unknown> = {
    user_id: ctx.user.id,
    body: trimmed,
    meta,
    updated_at: now,
  };
  if (lesson_id) {
    payload.lesson_id = lesson_id;
  }

  const { data, error } = await db
    .from("notes")
    .insert(payload)
    .select("id, lesson_id, body, meta, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const text = extractNoteIndexText({ body: data.body });
    if (text) await indexSource("note", data.id, text);
  } catch { /* non-blocking */ }

  return NextResponse.json({ note: { ...data, title: data.meta?.title ?? null } });
}

/** DELETE /api/notes?id=xxx — delete a note by id */
export async function DELETE(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = await createClient();
  const admin = createAdminClient();

  // Verify ownership
  const { data: existing } = await db
    .from("notes")
    .select("id")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await admin.from("rag_chunks").delete().eq("source_type", "note").eq("source_id", id);
  const { error } = await db.from("notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_id: id });
}
