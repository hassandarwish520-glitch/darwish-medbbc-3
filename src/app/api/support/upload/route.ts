import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BLOCKED_KEYWORDS = [
  "porn", "porno", "sex", "sexual", "nude", "nudity", "xxx", "fetish", "escort", "bikini", "lingerie",
  "اباح", "إباح", "جنسي", "عاري", "عارية", "اباحية", "xnxx", "xvideos",
];

function cleanName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "image";
}

function assetUrl(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function violatesNamePolicy(value: string) {
  const lower = value.toLowerCase();
  return BLOCKED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const caption = String(fd.get("caption") || "").trim();
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Only medical image files are allowed (JPG, PNG, WEBP, GIF)." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is too large. Max size is 8 MB." }, { status: 400 });
  if (violatesNamePolicy(file.name) || violatesNamePolicy(caption)) {
    return NextResponse.json({ error: "This upload was blocked by the chat safety policy." }, { status: 400 });
  }

  const safeName = cleanName(file.name || "image");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "png";
  const path = `support-chat/${ctx.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage.from("lesson-assets").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    path,
    url: assetUrl(path),
    name: file.name,
    type: file.type,
    size: file.size,
    caption,
  });
}
