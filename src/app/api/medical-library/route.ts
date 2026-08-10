import { NextRequest, NextResponse } from "next/server";
import { createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_ENTRY_TYPES = new Set(["note", "highlight", "bookmark", "canvas", "attachment"]);

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await createClient();
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lesson_id");
  const subjectSlug = url.searchParams.get("subject_slug");
  const entryType = url.searchParams.get("entry_type");
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 200);

  let query = db
    .from("medical_library_entries")
    .select("id, lesson_id, subject_slug, entry_type, title, body, quote, color, data, created_at, updated_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (lessonId) query = query.eq("lesson_id", lessonId);
  if (subjectSlug) query = query.eq("subject_slug", subjectSlug);
  if (entryType) query = query.eq("entry_type", entryType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await createClient();
  const { id, lesson_id, subject_slug, entry_type, title, body, quote, color, data } = await req.json();

  const type = typeof entry_type === "string" ? entry_type.trim() : "";
  if (!type) return NextResponse.json({ error: "entry_type is required" }, { status: 400 });
  if (!ALLOWED_ENTRY_TYPES.has(type)) {
    return NextResponse.json({ error: `unsupported entry_type: ${type}` }, { status: 400 });
  }

  const payload = {
    user_id: ctx.user.id,
    lesson_id: lesson_id || null,
    subject_slug: subject_slug || null,
    entry_type: type,
    title: typeof title === "string" ? title.trim() || null : null,
    body: typeof body === "string" ? body.trim() || null : null,
    quote: typeof quote === "string" ? quote.trim() || null : null,
    color: typeof color === "string" && color.trim() ? color.trim() : "#facc15",
    data: data && typeof data === "object" ? data : {},
  };

  if (id) {
    const { data: updated, error } = await db
      .from("medical_library_entries")
      .update({
        lesson_id: payload.lesson_id,
        subject_slug: payload.subject_slug,
        entry_type: payload.entry_type,
        title: payload.title,
        body: payload.body,
        quote: payload.quote,
        color: payload.color,
        data: payload.data,
      })
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: updated });
  }

  const { data: inserted, error } = await db
    .from("medical_library_entries")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: inserted });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await createClient();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db
    .from("medical_library_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted_id: id });
}
