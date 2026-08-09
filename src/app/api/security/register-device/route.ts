import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import {
  buildDeviceLabel,
  detectBrowser,
  detectDeviceType,
  detectPlatform,
  getClientIp,
  logSecurityEvent,
  sendSecurityAlertEmail,
} from "@/lib/security-monitor";

export const runtime = "nodejs";

const MAX_DEVICES = 3;

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deviceKey = typeof body?.device_key === "string" ? body.device_key.trim().slice(0, 160) : "";
  const path = typeof body?.path === "string" ? body.path.trim().slice(0, 300) : "";
  if (!deviceKey) {
    return NextResponse.json({ error: "device_key is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const userAgent = req.headers.get("user-agent") || "";
  const ipAddress = getClientIp(req);
  const deviceType = detectDeviceType(userAgent);
  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);
  const label = buildDeviceLabel(userAgent);
  const now = new Date().toISOString();

  const { data: existingRows } = await admin
    .from("user_devices")
    .select("id,user_id,device_key,device_type,label,last_seen_at,is_active,platform,browser,last_ip,user_agent,meta")
    .eq("user_id", ctx.user.id)
    .order("last_seen_at", { ascending: false });

  const devices = existingRows ?? [];
  const current = devices.find((row: any) => row.device_key === deviceKey) ?? null;
  const activeDevices = devices.filter((row: any) => row.is_active !== false);

  if (current && current.is_active === false) {
    return NextResponse.json({ error: "تم إلغاء هذا الجهاز من الحساب. سجّل الدخول من جهازك المصرّح به فقط." }, { status: 403 });
  }

  if (!current && activeDevices.length >= MAX_DEVICES) {
    await logSecurityEvent({
      userId: ctx.user.id,
      eventType: "device_limit_blocked",
      deviceKey,
      deviceType,
      metadata: {
        path,
        attempted_label: label,
        ip_address: ipAddress,
        active_device_count: activeDevices.length,
        browser,
        platform,
        user_agent: userAgent,
      },
    });
    return NextResponse.json({ error: "تم الوصول للحد الأقصى المسموح به: 3 أجهزة فقط لهذا الحساب." }, { status: 403 });
  }

  if (current) {
    await admin
      .from("user_devices")
      .update({
        device_type: deviceType,
        platform,
        browser,
        user_agent: userAgent,
        label,
        last_seen_at: now,
        last_ip: ipAddress,
        meta: {
          ...(current.meta && typeof current.meta === "object" ? current.meta : {}),
          last_path: path,
        },
        is_active: true,
      })
      .eq("id", current.id);
  } else {
    await admin.from("user_devices").insert({
      user_id: ctx.user.id,
      device_key: deviceKey,
      device_type: deviceType,
      platform,
      browser,
      user_agent: userAgent,
      label,
      first_seen_at: now,
      last_seen_at: now,
      last_ip: ipAddress,
      is_active: true,
      meta: { first_path: path, last_path: path },
    });

    await logSecurityEvent({
      userId: ctx.user.id,
      eventType: "device_registered",
      deviceKey,
      deviceType,
      metadata: {
        path,
        label,
        platform,
        browser,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    if (isAdminProfile(ctx.profile)) {
      await logSecurityEvent({
        userId: ctx.user.id,
        eventType: "admin_new_device_login",
        deviceKey,
        deviceType,
        metadata: {
          path,
          label,
          platform,
          browser,
          ip_address: ipAddress,
          user_agent: userAgent,
          email: ctx.profile?.email || ctx.user.email || null,
        },
      });

      await sendSecurityAlertEmail({
        subject: "Admin account login from a new device",
        text: `A new device accessed the admin account.\n\nEmail: ${ctx.profile?.email || ctx.user.email || "unknown"}\nDevice: ${label}\nPath: ${path || "/"}\nIP: ${ipAddress || "unknown"}\nBrowser: ${browser}\nPlatform: ${platform}\nTime: ${now}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Admin account login from a new device</h2><p><strong>Email:</strong> ${ctx.profile?.email || ctx.user.email || "unknown"}</p><p><strong>Device:</strong> ${label}</p><p><strong>Path:</strong> ${path || "/"}</p><p><strong>IP:</strong> ${ipAddress || "unknown"}</p><p><strong>Browser:</strong> ${browser}</p><p><strong>Platform:</strong> ${platform}</p><p><strong>Time:</strong> ${now}</p></div>`,
      });
    }
  }

  const total = current ? activeDevices.length : activeDevices.length + 1;
  return NextResponse.json({
    ok: true,
    device_count: total,
    max_devices: MAX_DEVICES,
    device: { label, device_type: deviceType, platform, browser },
  });
}
