import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";
export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(); if (!ctx) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("flashcards").insert({ ...body, created_by: ctx.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ card: data });
}
export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(); if (!ctx) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const id = new URL(req.url).searchParams.get("id")!;
  await createAdminClient().from("flashcards").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
