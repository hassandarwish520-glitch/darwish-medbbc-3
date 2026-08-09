// Secure internal viewer — streams lesson bytes without exposing storage URLs.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import { getClientIp, logSecurityEvent } from "@/lib/security-monitor";

/**
 * Sniff content-type from the storage path when the lesson.kind hint is missing
 * so a file uploaded with kind "document" but a `.pdf` extension is still served
 * as application/pdf and rendered by the in-app PDF viewer.
 */
function sniffContentType(storagePath: string, hint: "pdf" | "image" | "pptx" | "html" | "octet"): string {
  const lower = storagePath.toLowerCase();
  if (hint === "pdf" || lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (hint === "pptx" || lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (hint === "html" || lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "text/html; charset=utf-8";
  }
  return "application/octet-stream";
}

function safeFilename(name: string | null | undefined, fallback: string) {
  const base = (name || fallback).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.length > 80 ? base.slice(0, 80) : base;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fmt: string }> }) {
  const { id, fmt } = await params;
  const ctx = await requireActive();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("*").eq("id", id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) return new NextResponse("Not found", { status: 404 });

  const wantDownload = new URL(req.url).searchParams.get("download") === "1";
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";

  if (canPreviewHidden) {
    await logSecurityEvent({
      userId: ctx.user.id,
      eventType: wantDownload ? "admin_file_download" : "admin_file_view",
      metadata: {
        lesson_id: id,
        file_name: lesson.title,
        format: fmt,
        source: "viewer_route",
        path: lesson.storage_path || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }

  if (wantDownload && !canPreviewHidden) {
    const db = await createClient();
    try {
      await db.from("student_activity_logs").insert({
        user_id: ctx.user.id,
        activity_type: "pdf_download_blocked",
        lesson_id: id,
        metadata: { fmt },
      });
    } catch {}
    return NextResponse.json({ error: "Downloads are disabled for protected lesson files." }, { status: 403 });
  }

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

  const meta = (lesson.meta ?? {}) as { file_type?: string; mime?: string };
  const fileType = typeof meta.file_type === "string" ? meta.file_type : null;
  const mimeHint = typeof meta.mime === "string" ? meta.mime : null;

  const isPptx = fmt === "pptx" || fileType === "pptx" || lesson.kind === "pptx";
  const isImage = fmt === "image" || fileType === "image" || lesson.kind === "image";
  const isPdf = fmt === "pdf" || lesson.kind === "pdf" || fileType === "pdf";

  const hint: "pdf" | "image" | "pptx" | "html" | "octet" =
    isPdf ? "pdf" : isImage ? "image" : isPptx ? "pptx" : fmt === "html" ? "html" : "octet";

  const contentType = mimeHint && mimeHint !== "application/octet-stream"
    ? mimeHint
    : sniffContentType(lesson.storage_path, hint);

  const fileBase = safeFilename(lesson.title, `lesson-${id}`);
  const ext =
    isPdf ? "pdf" :
    isPptx ? "pptx" :
    isImage ? (lesson.storage_path.match(/\.(png|jpe?g|webp|gif|svg)$/i)?.[1]?.toLowerCase() ?? "img") :
    "bin";

  const disposition = wantDownload
    ? `attachment; filename="${fileBase}.${ext}"`
    : isPptx
      ? `attachment; filename="${fileBase}.${ext}"`
      : `inline; filename="${fileBase}.${ext}"`;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(blob.size),
    // Short cache so phone reloads after edits pick up new bytes without
    // re-streaming on every page navigation.
    "Cache-Control": "private, max-age=60, must-revalidate",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": disposition,
    // Critical so pdf.js on mobile can fetch ranges without forcing download.
    "Accept-Ranges": "bytes",
  };

  // Helper for inline PDFs: browsers and the in-app pdf.js reader need the
  // range header honoured or the first paint stalls on larger files.
  if (isPdf && !wantDownload) {
    headers["Content-Security-Policy"] = "frame-ancestors 'self'";
  }

  return new NextResponse(blob.stream(), { status: 200, headers });
}
