"use client";

/**
 * external-redirect.ts
 *
 * Single-purpose helper that decides whether a URL may leave the in-app
 * viewer. The rule is deliberately narrow:
 *
 *   - youtube.com / youtu.be / m.youtube.com  -> open in browser
 *     (the YouTube app deep links cannot be triggered reliably from a plain
 *      web tab; on Android Chrome the YT app picks up via OS intent,
 *      on iOS Safari it stays in browser — this is the practical behavior.)
 *   - t.me / telegram.me                     -> open in browser
 *     The `tg://` scheme is not honored by desktop Safari/Chrome and
 *      iOS Safari refuses custom schemes by default; opening the HTTPS
 *      variant is the only universally working approach.
 *   - anything else                          -> NEVER opened externally.
 *
 * Why this exists: items in the user's spec contradict each other (open
 * YouTube externally, but also "everything in-app, no external links, no
 * downloads"). This helper enforces the practical compromise used here.
 */

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

const TG_HOSTS = new Set(["t.me", "telegram.me", "www.telegram.me"]);

export type RedirectDecision =
  | { kind: "youtube"; href: string }
  | { kind: "telegram"; href: string }
  | { kind: "internal-only" };

function safeHostname(input: string): string | null {
  try {
    const parsed = new URL(input, "https://placeholder.invalid");
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyRedirect(rawUrl: string | null | undefined): RedirectDecision {
  if (!rawUrl) return { kind: "internal-only" };
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: "internal-only" };

  // Reject anything that is not https/http — we never honor custom schemes
  // from lesson content.
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
    return { kind: "internal-only" };
  }

  const host = safeHostname(trimmed.startsWith("/") ? "https://app.invalid" + trimmed : trimmed);
  if (!host) return { kind: "internal-only" };

  if (YT_HOSTS.has(host)) {
    // Normalize youtu.be to youtube.com for consistency.
    return { kind: "youtube", href: trimmed };
  }
  if (TG_HOSTS.has(host)) {
    return { kind: "telegram", href: trimmed };
  }
  return { kind: "internal-only" };
}

/**
 * Open a URL externally ONLY if it is YouTube or Telegram.
 * Returns true when the navigation happened, false when the URL was rejected
 * (so the caller can route it into the in-app viewer).
 */
export function openExternalIfAllowed(rawUrl: string | null | undefined): boolean {
  const decision = classifyRedirect(rawUrl);
  if (decision.kind === "internal-only") return false;
  if (typeof window === "undefined") return false;

  // Use window.location.assign — same-tab so the user can return on the
  // back button and our page's visibilitychange handler restores the lesson
  // they were on. Do NOT use window.open with _blank (the spec forbids this).
  window.location.assign(decision.href);
  return true;
}
