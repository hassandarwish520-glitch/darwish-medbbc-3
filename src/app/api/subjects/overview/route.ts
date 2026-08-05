import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/supabase/server";
import { getSubjectOverviews } from "@/lib/subject-data";

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const exam = new URL(req.url).searchParams.get("exam") || "IFOM_CSE";
  const subjects = await getSubjectOverviews(exam);
  return NextResponse.json({ exam, subjects });
}
