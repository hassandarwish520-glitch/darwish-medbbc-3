import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PREPARATION_TYPES = [
  "USMLE",
  "IFOM",
  "MBBS",
  "Medical School Exams",
  "Residency Preparation",
  "Other",
] as const;

const CURRENT_LEVELS = [
  "Medical Student — Year 1",
  "Medical Student — Year 2",
  "Medical Student — Year 3",
  "Medical Student — Year 4",
  "Medical Student — Year 5",
  "Medical Student — Year 6",
  "Intern / House Officer",
  "Medical Graduate",
  "Resident",
  "Practicing Physician",
  "Other",
] as const;

const PURPOSE_OPTIONS = [
  "Q-Bank study and question practice",
  "Exam preparation (USMLE / IFOM / MBBS)",
  "Medical school revision",
  "Clinical knowledge refresh",
  "Other academic purpose",
] as const;

const PLAN_OPTIONS = ["1 Month Plan", "3 Months Plan"] as const;

type RegisterBody = {
  email?: string;
  password?: string;
  full_name?: string;
  institution?: string;
  preparation_type?: string;
  current_level?: string;
  purpose_of_access?: string;
  selected_plan?: string;
  role?: string;
};

const VALID_PREPARATION_TYPES = new Set<string>(PREPARATION_TYPES);
const VALID_CURRENT_LEVELS = new Set<string>(CURRENT_LEVELS);
const VALID_PURPOSE_OPTIONS = new Set<string>(PURPOSE_OPTIONS);
const VALID_PLAN_OPTIONS = new Set<string>(PLAN_OPTIONS);

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
  const preparation_type = (body.preparation_type || "").trim();
  const current_level = (body.current_level || "").trim();
  const purpose_of_access = (body.purpose_of_access || "").trim();
  const selected_plan = (body.selected_plan || "").trim();
  const role = inferRole(email);

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  if (!institution) {
    return NextResponse.json({ error: "institution is required" }, { status: 400 });
  }
  if (!VALID_PREPARATION_TYPES.has(preparation_type)) {
    return NextResponse.json({ error: "exam / preparation type is required" }, { status: 400 });
  }
  if (!VALID_CURRENT_LEVELS.has(current_level)) {
    return NextResponse.json({ error: "current level is required" }, { status: 400 });
  }
  if (!VALID_PURPOSE_OPTIONS.has(purpose_of_access)) {
    return NextResponse.json({ error: "purpose of access is required" }, { status: 400 });
  }
  if (!VALID_PLAN_OPTIONS.has(selected_plan)) {
    return NextResponse.json({ error: "selected plan is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || email.split("@")[0],
      institution: institution || null,
      preparation_type,
      current_level,
      purpose_of_access,
      selected_plan,
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
        preparation_type,
        current_level,
        purpose_of_access,
        selected_plan,
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
