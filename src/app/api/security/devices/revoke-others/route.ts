import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireActive } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-monitor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentDeviceKey = typeof body?.device_key === "string" ? body.device_key.trim().slice(0, 160) : "";
  if (!currentDeviceKey) {
    return NextResponse.json({ error: "device_key is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: devices } = await admin
    .from("user_devices")
    .select("id,user_id,device_key,device_type,label,meta,is_active")
    .eq("user_id", ctx.user.id)
    .neq("device_key", currentDeviceKey)
    .eq("is_active", true);

  const rows = devices ?? [];
  if (!rows.length) return NextResponse.json({ ok: true, revoked: 0 });

  const ids = rows.map((row: any) => row.id);
  await admin
    .from("user_devices")
    .update({ is_active: false })
    .in("id", ids);

  await Promise.all(rows.map((row: any) => logSecurityEvent({
    userId: row.user_id,
    eventType: "device_revoked",
    deviceKey: row.device_key,
    deviceType: row.device_type,
    metadata: {
      label: row.label,
      revoked_by: ctx.user.id,
      revoke_reason: "revoke other devices",
    },
  })));

  return NextResponse.json({ ok: true, revoked: rows.length });
}
