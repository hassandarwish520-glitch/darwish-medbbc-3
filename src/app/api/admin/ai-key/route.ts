/**
 * POST /api/admin/ai-key
 * Stores the AI API key in the app_settings table.
 * Only admins can set this.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { key } = await req.json();
  if (!key || typeof key !== "string" || !key.trim()) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Try to upsert into app_settings table (create it if it doesn't exist via upsert)
  const { error } = await admin.from("app_settings").upsert(
    { key: "openai_api_key", value: key.trim(), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    // Table may not exist — provide helpful instructions
    return NextResponse.json(
      {
        error:
          "Could not save key to database. Please set OPENAI_API_KEY in your Vercel environment variables instead: Vercel Dashboard → Your Project → Settings → Environment Variables.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
