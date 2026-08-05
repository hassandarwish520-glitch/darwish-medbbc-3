// Secure internal viewer — streams lesson bytes without exposing storage URLs.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fmt: string }> }) {
  const { id, fmt } = await params;
  const ctx = await requireActive();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) return new NextResponse("Not found", { status: 404 });

  if (fmt === "html" && lesson.kind === "html" && lesson.html_body) {
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

  const fileType = typeof lesson.meta?.file_type === "string" ? lesson.meta.file_type : null;
  const isPptx = fmt === "pptx" || fileType === "pptx";
  const isImage = fmt === "image" || fileType === "image";

  let contentType = "application/octet-stream";
  let disposition = "inline";
  if (isPptx) {
    contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    disposition = `attachment; filename="${encodeURIComponent(lesson.title || "presentation")}.pptx"`;
  } else if (isImage) {
    const storagePath = lesson.storage_path ?? "";
    const lower = storagePath.toLowerCase();
    contentType = lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : lower.endsWith(".gif") ? "image/gif" : "image/jpeg";
  } else if (fmt === "pdf" || lesson.kind === "pdf") {
    contentType = "application/pdf";
  } else if (fmt === "html") {
    contentType = "text/html; charset=utf-8";
  }

  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(blob.size),
      "Cache-Control": "private, max-age=3600",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Disposition": disposition,
    },
  });
}
