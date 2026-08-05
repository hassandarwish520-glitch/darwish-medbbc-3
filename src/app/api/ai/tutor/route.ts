import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/supabase/server";
import { tutorAnswer } from "@/lib/ai/tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const {
      question,
      history,
      mode,
      lesson_title,
      lesson_context,
      companion_notes,
    } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const { answer, citations } = await tutorAnswer(question, {
      history: Array.isArray(history) ? history : [],
      mode: mode === "exam" ? "exam" : "tutor",
      lessonTitle: typeof lesson_title === "string" ? lesson_title : "",
      lessonContext: typeof lesson_context === "string" ? lesson_context : "",
      companionNotes: typeof companion_notes === "string" ? companion_notes : "",
    });

    return NextResponse.json({ answer, citations });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "ai error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
