/**
 * POST /api/flashcards/manual
 *
 * Creates one or more flashcards manually (student-created).
 * Accepts JSON: { front, back, lesson_id?, tags?, image_url? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const { front, back, lesson_id, tags, image_url } = body as {
    front: string;
    back: string;
    lesson_id?: string;
    tags?: string[];
    image_url?: string;
  };

  if (!front?.trim() || !back?.trim()) {
    return NextResponse.json(
      { error: "Both front and back are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const row = {
    front: front.trim(),
    back: back.trim(),
    lesson_id: lesson_id || null,
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    image_url: image_url || null,
    ai_generated: false,
    created_by: ctx.user.id,
  };

  const { data, error } = await admin
    .from("flashcards")
    .insert(row)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, inserted: 1 });
}
