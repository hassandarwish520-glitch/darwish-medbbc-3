import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("courses").insert({ ...body, created_by: ctx.user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data });
}
export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(); if (!ctx) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const { id, ...patch } = await req.json();
  const admin = createAdminClient();
  const { data, error } = await admin.from("courses").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course: data });
}
export async function DELETE(req: NextRequest) {
  const ctx = await requireAdmin(); if (!ctx) return NextResponse.json({ error:"forbidden" }, { status:403 });
  const id = new URL(req.url).searchParams.get("id")!;
  const admin = createAdminClient();
  await admin.from("courses").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
