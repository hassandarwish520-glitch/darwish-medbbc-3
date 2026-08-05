import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { indexSource } from "@/lib/ai/rag";
import { extractFlashcardIndexText } from "@/lib/ai/source-text";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("flashcards").insert({ ...body, created_by: ctx.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const text = extractFlashcardIndexText(data);
    if (text) await indexSource("flashcard", data.id, text);
  } catch {
    // keep flashcard creation non-blocking
  }

  return NextResponse.json({ card: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("flashcards").select("id").eq("id", id).single();
  if (lookupError || !existing) return NextResponse.json({ error: "flashcard not found" }, { status: 404 });

  const cleanup = await Promise.all([
    admin.from("flashcard_reviews").delete().eq("flashcard_id", id),
    admin.from("generated_flashcards").delete().eq("flashcard_id", id),
    admin.from("rag_chunks").delete().eq("source_type", "flashcard").eq("source_id", id),
  ]);
  const cleanupError = cleanup.find((entry) => entry.error)?.error;
  if (cleanupError) return NextResponse.json({ error: cleanupError.message }, { status: 500 });

  const { error: deleteError } = await admin.from("flashcards").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_id: id });
}
