import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function normalizeStem(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512);
}

export async function POST() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("questions")
    .select("id, stem, lesson_id, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Map<string, string>(); // key -> kept id
  const toDelete: string[] = [];
  let kept = 0;

  for (const row of rows ?? []) {
    const stemKey = normalizeStem(row.stem);
    if (!stemKey) { kept += 1; continue; }
    const bucket = `${row.lesson_id ?? "_null"}::${stemKey}`;
    if (seen.has(bucket)) {
      toDelete.push(row.id);
    } else {
      seen.set(bucket, row.id);
      kept += 1;
    }
  }

  if (toDelete.length) {
    // Clean dependents first so foreign keys do not block.
    await admin.from("question_attempts").delete().in("question_id", toDelete);
    await admin.from("question_evidence").delete().in("question_id", toDelete);
    await admin.from("generated_questions").delete().in("question_id", toDelete);
    await admin
      .from("rag_chunks")
      .delete()
      .eq("source_type", "question")
      .in("source_id", toDelete);

    const { error: delErr } = await admin.from("questions").delete().in("id", toDelete);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  revalidateTag("subject-base-data");

  return NextResponse.json({ removed: toDelete.length, kept });
}
