import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export type DeviceType = "mobile" | "tablet" | "laptop";
export type SecurityEventType =
  | "device_registered"
  | "device_limit_blocked"
  | "device_revoked"
  | "admin_new_device_login"
  | "admin_file_view"
  | "admin_file_download";

export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/android/.test(ua) && !/mobile/.test(ua)) return "tablet";
  if (/iphone|ipod|android.+mobile|windows phone|mobile/.test(ua)) return "mobile";
  return "laptop";
}

export function detectPlatform(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown OS";
}

export function detectBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  return "Unknown Browser";
}

export function buildDeviceLabel(userAgent: string) {
  const platform = detectPlatform(userAgent);
  const browser = detectBrowser(userAgent);
  const type = detectDeviceType(userAgent);
  const typeLabel = type === "laptop" ? "Laptop/Desktop" : type === "tablet" ? "Tablet" : "Mobile";
  return `${platform} · ${browser} · ${typeLabel}`;
}

export function getClientIp(req: Request | NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

export async function logSecurityEvent(args: {
  userId: string;
  eventType: SecurityEventType;
  deviceKey?: string | null;
  deviceType?: DeviceType | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("security_events").insert({
      user_id: args.userId,
      event_type: args.eventType,
      device_key: args.deviceKey ?? null,
      device_type: args.deviceType ?? null,
      metadata: args.metadata ?? {},
    });
  } catch {
    // Best-effort security logging only.
  }
}

export async function sendSecurityAlertEmail(args: {
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SECURITY_ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  const to = "hassandarwish520@gmail.com";

  if (!apiKey || !from) {
    return { ok: false as const, reason: "missing_email_config" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        reason: `email_http_${response.status}`,
      };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "email_request_failed" };
  }
}
