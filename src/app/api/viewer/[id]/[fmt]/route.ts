// Secure internal viewer — streams lesson bytes without exposing storage URLs.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string; fmt: string } }) {
  const ctx = await requireActive();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", params.id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) return new NextResponse("Not found", { status: 404 });

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

  if (!lesson.storage_path) return new NextResponse("No content", { status: 404 });
  const { data: blob, error } = await admin.storage.from("lesson-assets").download(lesson.storage_path);
  if (error || !blob) return new NextResponse("Storage error", { status: 500 });

  const contentType =
    params.fmt === "pdf"
      ? "application/pdf"
      : params.fmt === "html"
        ? "text/html; charset=utf-8"
        : "application/octet-stream";

  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(blob.size),
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Disposition": "inline",
    },
  });
}
