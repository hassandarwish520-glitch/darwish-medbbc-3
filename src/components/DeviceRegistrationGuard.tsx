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

async function enforceRegistration(pathname: string, force = false) {
  const deviceKey = getDeviceKey();
  const sessionToken = `${deviceKey}:${pathname}`;
  if (!force && window.sessionStorage.getItem(DEVICE_REGISTERED_SESSION) === sessionToken) return;

  const response = await fetch("/api/security/register-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_key: deviceKey, path: pathname }),
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 403) {
    try {
      await createClient().auth.signOut();
    } catch {}
    const message = typeof payload?.error === "string"
      ? payload.error
      : "This account can no longer use this device.";
    window.location.href = `/sign-in?authError=${encodeURIComponent(message)}`;
    return;
  }

  if (response.ok) {
    window.sessionStorage.setItem(DEVICE_REGISTERED_SESSION, sessionToken);
  }
}

export default function DeviceRegistrationGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const run = async (force = false) => {
      try {
        if (!cancelled) await enforceRegistration(pathname, force);
      } catch {
        // Silent fail — do not block browsing when telemetry is unavailable.
      }
    };

    void run(false);

    const interval = window.setInterval(() => {
      void run(true);
    }, 45000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run(true);
      }
    };

    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
