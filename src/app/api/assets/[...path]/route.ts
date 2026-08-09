import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import { getClientIp, logSecurityEvent } from "@/lib/security-monitor";

export const runtime = "nodejs";

function inferType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const ctx = await requireActive();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });

  const { path: pathSegs } = await params;
  const path = (pathSegs ?? []).map(decodeURIComponent).join("/");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage.from("lesson-assets").download(path);
  if (error || !blob) return new NextResponse("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = path.split("/").pop() || "file";
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";

  if (isAdminProfile(ctx.profile)) {
    await logSecurityEvent({
      userId: ctx.user.id,
      eventType: download ? "admin_file_download" : "admin_file_view",
      metadata: {
        path,
        file_name: filename,
        mime_type: inferType(path),
        source: "assets_route",
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }

  const isPdf = inferType(path) === "application/pdf";

  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      "Content-Type": inferType(path),
      "Content-Length": String(blob.size),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      // For PDFs served inline: tell the browser not to offer a "save" dialog
      ...(isPdf && !download ? {
        "X-Download-Options": "noopen",
        "Content-Security-Policy": "frame-ancestors 'self'",
      } : {}),
    },
  });
}
