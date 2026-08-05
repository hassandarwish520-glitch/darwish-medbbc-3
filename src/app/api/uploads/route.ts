import { NextRequest, NextResponse } from "next/server";
import { requireActive, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/uploads
 * Student-facing image upload endpoint.
 * Requires an active session. Stores under student-uploads/{userId}/ in lesson-assets bucket.
 * Returns { path, url }
 */
export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10 MB)" }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const safeName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const storagePath = `student-uploads/${ctx.user.id}/${safeName}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("lesson-assets")
    .upload(storagePath, new Uint8Array(bytes), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const url = `/api/assets/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
  return NextResponse.json({ path: storagePath, url });
}
