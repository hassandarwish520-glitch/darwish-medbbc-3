import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-monitor";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "revoked by admin";

  const admin = createAdminClient();
  const { data: device } = await admin
    .from("user_devices")
    .select("id,user_id,device_key,device_type,label,meta,is_active")
    .eq("id", id)
    .single();

  if (!device) return NextResponse.json({ error: "device_not_found" }, { status: 404 });

  await admin
    .from("user_devices")
    .update({
      is_active: false,
      meta: {
        ...(device.meta && typeof device.meta === "object" ? device.meta : {}),
        revoked_at: new Date().toISOString(),
        revoked_by: ctx.user.id,
        revoke_reason: reason,
      },
    })
    .eq("id", id);

  await logSecurityEvent({
    userId: device.user_id,
    eventType: "device_revoked",
    deviceKey: device.device_key,
    deviceType: device.device_type,
    metadata: {
      label: device.label,
      revoked_by: ctx.user.id,
      revoke_reason: reason,
    },
  });

  return NextResponse.json({ ok: true });
}
