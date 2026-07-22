import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, action } = await req.json();
  const admin = createAdminClient();
  const patch: any = {};

  if (action === "activate" || action === "reactivate") {
    patch.status = "active";
    patch.activated_at = new Date().toISOString();
    patch.activated_by = ctx.user.id;
  } else if (action === "suspend") {
    patch.status = "suspended";
  } else return NextResponse.json({ error: "bad action" }, { status: 400 });

  const { data: row, error } = await admin.from("profiles").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row });
}
