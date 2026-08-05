import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("source_documents")
    .select("id,title,exam_code,subject_title,topic_title,status,chunk_count,processed_at,created_at")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "document not found" }, { status: 404 });
  return NextResponse.json({ document: data });
}
