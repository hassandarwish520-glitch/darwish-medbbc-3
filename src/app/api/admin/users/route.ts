import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, action } = await req.json();
  const admin = createAdminClient();
  const patch: Record<string, string> = {};

  if (action === "activate" || action === "reactivate" || action === "confirm") {
    const { error: confirmError } = await admin.auth.admin.updateUserById(id, {
      email_confirm: true,
    });

    if (confirmError) {
      return NextResponse.json({ error: confirmError.message }, { status: 500 });
    }

    if (action !== "confirm") {
      patch.status = "active";
      patch.activated_at = new Date().toISOString();
      patch.activated_by = ctx.user.id;
    }
  } else if (action === "suspend") {
    patch.status = "suspended";
  } else {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }

  if (action === "confirm") {
    const { data: row, error } = await admin
      .from("profiles")
      .select()
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row });
  }

  const { data: row, error } = await admin.from("profiles").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row });
}
