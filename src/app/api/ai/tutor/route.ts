import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/supabase/server";
import { tutorAnswer } from "@/lib/ai/tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { question, history } = await req.json();
    if (!question?.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });
    const { answer, citations } = await tutorAnswer(question, history ?? []);
    return NextResponse.json({ answer, citations });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "ai error" }, { status: 500 });
  }
}
