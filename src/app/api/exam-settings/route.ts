import { NextRequest, NextResponse } from "next/server";
import { createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await createClient();
  const { data, error } = await db
    .from("student_exam_settings")
    .select("exam_code, exam_date, reminder_slot, updated_at")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ exam_date: null, reminder_slot: null, updated_at: null }, { status: 200 });
  return NextResponse.json(data ?? { exam_date: null, reminder_slot: null, updated_at: null });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const examDate = typeof body?.exam_date === "string" && body.exam_date.trim() ? body.exam_date.trim() : null;
  const reminderSlot = typeof body?.reminder_slot === "string" && body.reminder_slot.trim() ? body.reminder_slot.trim() : null;

  if (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    return NextResponse.json({ error: "invalid exam_date" }, { status: 400 });
  }

  const db = await createClient();
  const { data, error } = await db
    .from("student_exam_settings")
    .upsert({
      user_id: ctx.user.id,
      exam_code: "IFOM_CSE",
      exam_date: examDate,
      reminder_slot: reminderSlot,
      source: "notifications_page",
    }, { onConflict: "user_id" })
    .select("exam_code, exam_date, reminder_slot, updated_at")
    .single();

  if (!error) {
    try {
      await db.from("student_activity_logs").insert({
        user_id: ctx.user.id,
        activity_type: "exam_date_saved",
        metadata: { exam_code: "IFOM_CSE", exam_date: examDate, reminder_slot: reminderSlot },
      });
    } catch {}
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, setting: data });
}
