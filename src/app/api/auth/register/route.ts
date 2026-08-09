import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RegisterBody = {
  email?: string;
  password?: string;
  full_name?: string;
  institution?: string;
  current_level?: string;
  role?: string;
};

const VALID_CURRENT_LEVELS = new Set(["Medical Student", "Medical Graduate", "Resident", "Other"]);

function inferRole(email: string) {
  if (email === "hassandarwish520@gmail.com") return "admin";
  return "student";
}

export async function POST(req: NextRequest) {
  let body: RegisterBody = {};
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const full_name = (body.full_name || "").trim();
  const institution = (body.institution || "").trim();
  const current_level = (body.current_level || "").trim();
  const role = inferRole(email);

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  if (!VALID_CURRENT_LEVELS.has(current_level)) {
    return NextResponse.json({ error: "current level is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || email.split("@")[0],
      institution: institution || null,
      current_level,
      role,
    },
  });

  if (createError || !created?.user) {
    const message = createError?.message || "Failed to create account";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const userId = created.user.id;
  const isAdmin = email === "hassandarwish520@gmail.com";
  const status = isAdmin ? "active" : "pending";
  const activated_at = isAdmin ? new Date().toISOString() : null;

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: full_name || email.split("@")[0],
        institution: institution || null,
        current_level,
        role,
        status,
        activated_at,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user_id: userId,
    status,
    role,
  });
}
