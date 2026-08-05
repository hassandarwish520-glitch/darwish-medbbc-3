import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "file";
}

function assetUrl(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const folder = String(fd.get("folder") || "uploads").replace(/^\/+|\/+$/g, "") || "uploads";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const safeName = cleanName(file.name || "file");
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage.from("lesson-assets").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    path,
    url: assetUrl(path),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
}
