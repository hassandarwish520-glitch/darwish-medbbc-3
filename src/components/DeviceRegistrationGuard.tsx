"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEVICE_KEY_STORAGE = "medbbc:device-key";
const DEVICE_REGISTERED_SESSION = "medbbc:device-registered";

function getDeviceKey() {
  const existing = window.localStorage.getItem(DEVICE_KEY_STORAGE);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY_STORAGE, next);
  return next;
}

export default function DeviceRegistrationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const deviceKey = getDeviceKey();
    const sessionToken = `${deviceKey}:${pathname}`;
    if (window.sessionStorage.getItem(DEVICE_REGISTERED_SESSION) === sessionToken) return;

    fetch("/api/security/register-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_key: deviceKey, path: pathname }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!active) return;

        if (response.status === 403) {
          try {
            await createClient().auth.signOut();
          } catch {}
          const message = typeof payload?.error === "string"
            ? payload.error
            : "This account has reached the maximum number of allowed devices.";
          window.location.href = `/sign-in?authError=${encodeURIComponent(message)}`;
          return;
        }

        if (response.ok) {
          window.sessionStorage.setItem(DEVICE_REGISTERED_SESSION, sessionToken);
        }
      })
      .catch(() => {
        // Silent fail — do not block normal browsing if telemetry is temporarily unavailable.
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
