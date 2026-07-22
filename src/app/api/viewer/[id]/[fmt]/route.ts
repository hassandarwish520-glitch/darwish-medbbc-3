// Secure internal viewer — streams lesson bytes without exposing storage URLs.
import { NextRequest, NextResponse } from "next/server";
import { requireActive, createAdminClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string; fmt: string } }) {
  const ctx = await requireActive();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", params.id).single();
  if (!lesson || !lesson.visible) return new NextResponse("Not found", { status: 404 });

  // Inline HTML lessons: serve html_body directly (already contains embedded CSS/JS).
  if (params.fmt === "html" && lesson.kind === "html" && lesson.html_body) {
    return new NextResponse(lesson.html_body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }

  // Otherwise, stream from private Storage bucket.
  if (!lesson.storage_path) return new NextResponse("No content", { status: 404 });
  const { data: blob, error } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
  if (error || !blob) return new NextResponse("Storage error", { status: 500 });

  const ct =
    params.fmt === "pdf"  ? "application/pdf" :
    params.fmt === "html" ? "text/html; charset=utf-8" :
    "application/octet-stream";

  const buf = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Disposition": "inline",
    },
  });
}
