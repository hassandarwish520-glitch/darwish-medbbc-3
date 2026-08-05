import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { indexSource } from "@/lib/ai/rag";
import { extractQuestionIndexText } from "@/lib/ai/source-text";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();
  const payload = {
    ...body,
    created_by: ctx.user.id,
    image_path: typeof body.image_path === "string" ? body.image_path : null,
    image_caption: typeof body.image_caption === "string" ? body.image_caption : null,
    video_url: typeof body.video_url === "string" && body.video_url.trim() ? body.video_url.trim() : null,
  };

  const { data, error } = await admin.from("questions").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const text = extractQuestionIndexText(data);
    if (text) await indexSource("question", data.id, text);
  } catch {
    // keep question creation non-blocking
  }

  return NextResponse.json({ question: data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();

  // Only allow safe fields to be patched
  const allowed: Record<string, unknown> = {};
  if ("video_url" in updates) allowed.video_url = typeof updates.video_url === "string" && updates.video_url.trim() ? updates.video_url.trim() : null;
  if ("image_path" in updates) allowed.image_path = updates.image_path ?? null;
  if ("image_caption" in updates) allowed.image_caption = updates.image_caption ?? null;
  if ("explanation" in updates) allowed.explanation = updates.explanation ?? null;
  if ("difficulty" in updates) allowed.difficulty = updates.difficulty;
  if ("tags" in updates) allowed.tags = updates.tags;

  if (!Object.keys(allowed).length) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const { data, error } = await admin.from("questions").update(allowed).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ question: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("questions")
    .select("id,image_path")
    .eq("id", id)
    .single();

  if (lookupError || !existing) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  const cleanup = await Promise.all([
    admin.from("question_attempts").delete().eq("question_id", id),
    admin.from("question_evidence").delete().eq("question_id", id),
    admin.from("generated_questions").delete().eq("question_id", id),
    admin.from("rag_chunks").delete().eq("source_type", "question").eq("source_id", id),
  ]);

  const cleanupError = cleanup.find((entry) => entry.error)?.error;
  if (cleanupError) {
    return NextResponse.json({ error: cleanupError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("questions").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (existing.image_path && !/^(https?:|data:|blob:|\/)\/?.*/i.test(existing.image_path)) {
    await admin.storage.from("lesson-assets").remove([existing.image_path]).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, deleted_id: id });
}
