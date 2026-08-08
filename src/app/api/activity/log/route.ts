import { NextRequest, NextResponse } from "next/server";
import { createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_ACTIVITY_TYPES = new Set([
  "pdf_view",
  "pdf_download_blocked",
  "pdf_open_blocked",
  "lesson_open",
  "exam_date_saved",
]);

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const activityType = typeof payload?.activity_type === "string" ? payload.activity_type.trim() : "";
  const lessonId = typeof payload?.lesson_id === "string" && payload.lesson_id.trim() ? payload.lesson_id.trim() : null;
  const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  if (!ALLOWED_ACTIVITY_TYPES.has(activityType)) {
    return NextResponse.json({ error: "invalid activity_type" }, { status: 400 });
  }

  const db = await createClient();
  const { error } = await db.from("student_activity_logs").insert({
    user_id: ctx.user.id,
    activity_type: activityType,
    lesson_id: lessonId,
    metadata,
  });

  if (error) {
    return NextResponse.json({ ok: false, ignored: true }, { status: 202 });
  }

  return NextResponse.json({ ok: true });
}
