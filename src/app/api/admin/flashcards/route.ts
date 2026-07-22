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

  const id = new URL(req.url).searchParams.get("id")!;
  const admin = createAdminClient();
  await admin.from("flashcards").delete().eq("id", id);
  await admin.from("rag_chunks").delete().eq("source_type", "flashcard").eq("source_id", id);
  return NextResponse.json({ ok: true });
}
