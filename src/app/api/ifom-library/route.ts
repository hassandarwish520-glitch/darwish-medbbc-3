import { NextRequest, NextResponse } from "next/server";
import { requireActive, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** GET /api/ifom-library  — list all items for the current user */
export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const subject = url.searchParams.get("subject");

  const db = await (await import("@/lib/supabase/server")).createClient();
  let q = db
    .from("ifom_library")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false });

  if (type) q = q.eq("type", type);
  if (subject && subject !== "All") q = q.eq("subject", subject);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/** POST /api/ifom-library — create a new item */
export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { type, subject, title, body: itemBody, hint, choices, answer_key, image_path, image_caption, tags } = body;

  if (!type || !["image_question", "ultrashot", "flashcard", "note"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!title?.trim() && !itemBody?.trim()) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const db = await (await import("@/lib/supabase/server")).createClient();
  const { data, error } = await db
    .from("ifom_library")
    .insert({
      user_id: ctx.user.id,
      type,
      subject: subject?.trim() || "General",
      title: title?.trim() || null,
      body: itemBody?.trim() || null,
      hint: hint?.trim() || null,
      choices: choices ?? null,
      answer_key: answer_key?.trim() || null,
      image_path: image_path || null,
      image_caption: image_caption?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

/** DELETE /api/ifom-library?id=... — delete an item and its storage image */
export async function DELETE(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = await (await import("@/lib/supabase/server")).createClient();

  // Fetch first to get image_path for cleanup
  const { data: item } = await db
    .from("ifom_library")
    .select("id, image_path")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.image_path) {
    const admin = createAdminClient();
    await admin.storage.from("lesson-assets").remove([item.image_path]).catch(() => {});
  }

  const { error } = await db
    .from("ifom_library")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
