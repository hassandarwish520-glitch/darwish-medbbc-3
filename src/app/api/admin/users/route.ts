import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase/server";

const VALID_ROLES = new Set(["student", "educator", "admin"]);

function inferRole(email: string | null | undefined, metaRole: unknown, fallbackRole?: string | null) {
  if (fallbackRole) return fallbackRole;
  if (email === "hassandarwish520@gmail.com") return "admin";
  const raw = typeof metaRole === "string" ? metaRole.toLowerCase().trim() : "";
  if (raw === "educator" || raw === "instructor") return "educator";
  if (raw === "admin") return "admin";
  return "student";
}

async function ensureProfile(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: authUserData, error: authError } = await admin.auth.admin.getUserById(id);
  if (authError || !authUserData?.user) {
    return { error: authError?.message || "user not found", row: null as Record<string, unknown> | null };
  }

  const authUser = authUserData.user;
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const { data: existing } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();

  const payload = {
    id,
    email: authUser.email,
    full_name:
      existing?.full_name ??
      (typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : authUser.email?.split("@")[0] ?? null),
    institution:
      existing?.institution ??
      (typeof meta.institution === "string" && meta.institution.trim() ? meta.institution.trim() : null),
    preparation_type:
      existing?.preparation_type ??
      (typeof meta.preparation_type === "string" && meta.preparation_type.trim() ? meta.preparation_type.trim() : null),
    current_level:
      existing?.current_level ??
      (typeof meta.current_level === "string" && meta.current_level.trim() ? meta.current_level.trim() : null),
    purpose_of_access:
      existing?.purpose_of_access ??
      (typeof meta.purpose_of_access === "string" && meta.purpose_of_access.trim() ? meta.purpose_of_access.trim() : null),
    selected_plan:
      existing?.selected_plan ??
      (typeof meta.selected_plan === "string" && meta.selected_plan.trim() ? meta.selected_plan.trim() : null),
    role: inferRole(authUser.email, meta.role, existing?.role),
    status: existing?.status ?? (authUser.email === "hassandarwish520@gmail.com" ? "active" : "pending"),
    activated_at: existing?.activated_at ?? (authUser.email === "hassandarwish520@gmail.com" ? new Date().toISOString() : null),
    activated_by: existing?.activated_by ?? null,
  };

  const { data: row, error } = await admin
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return { error: error.message, row: null as Record<string, unknown> | null };
  }

  return {
    error: null,
    row: {
      ...row,
      email_confirmed_at: authUser.email_confirmed_at ?? authUser.confirmed_at ?? null,
    },
  };
}

async function fetchProfileWithConfirmation(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: row, error: rowError } = await admin.from("profiles").select("*").eq("id", id).single();
  if (rowError) return { error: rowError.message, row: null as Record<string, unknown> | null };

  const { data: authUserData, error: authError } = await admin.auth.admin.getUserById(id);
  if (authError) return { error: authError.message, row: null as Record<string, unknown> | null };

  const email_confirmed_at = authUserData?.user?.email_confirmed_at ?? authUserData?.user?.confirmed_at ?? null;
  return { error: null, row: { ...row, email_confirmed_at } };
}

async function grantAccess(admin: ReturnType<typeof createAdminClient>, id: string, activatedBy: string) {
  const { error: confirmError } = await admin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });
  if (confirmError) return confirmError.message;

  const { error: activateError } = await admin
    .from("profiles")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      activated_by: activatedBy,
    })
    .eq("id", id);

  return activateError?.message ?? null;
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, action, role } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "missing payload" }, { status: 400 });

  const admin = createAdminClient();
  const ensured = await ensureProfile(admin, id);
  if (ensured.error) return NextResponse.json({ error: ensured.error }, { status: 500 });

  if (action === "confirm_email") {
    const { error: confirmError } = await admin.auth.admin.updateUserById(id, {
      email_confirm: true,
    });
    if (confirmError) return NextResponse.json({ error: confirmError.message }, { status: 500 });

    const result = await fetchProfileWithConfirmation(admin, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ row: result.row });
  }

  if (action === "approve_access" || action === "activate" || action === "reactivate") {
    const grantError = await grantAccess(admin, id, ctx.user.id);
    if (grantError) return NextResponse.json({ error: grantError }, { status: 500 });

    const result = await fetchProfileWithConfirmation(admin, id);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ row: result.row });
  }

  const patch: Record<string, unknown> = {};

  if (action === "suspend") {
    patch.status = "suspended";
  } else if (action === "set_role") {
    if (!VALID_ROLES.has(role)) return NextResponse.json({ error: "invalid role" }, { status: 400 });
    if (id === ctx.user.id && role !== "admin") {
      return NextResponse.json({ error: "cannot downgrade current admin" }, { status: 400 });
    }
    patch.role = role;
  } else {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = await fetchProfileWithConfirmation(admin, id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ row: result.row });
}
