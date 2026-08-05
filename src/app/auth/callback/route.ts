import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type CookieWrite = { name: string; value: string; options?: Record<string, unknown> };

function env(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const cookieStore = await cookies();

  const supabase = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: CookieWrite[]) => {
        list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  let errorMessage: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) errorMessage = error.message;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) errorMessage = error.message;
  } else {
    errorMessage = "Missing authentication token.";
  }

  if (errorMessage) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("authError", errorMessage);
    return NextResponse.redirect(signInUrl);
  }

  const redirectUrl = new URL(next, request.url);
  if (type === "recovery" || next === "/reset-password") {
    redirectUrl.searchParams.set("recovery", "1");
  } else {
    redirectUrl.searchParams.set("verified", "1");
  }
  return NextResponse.redirect(redirectUrl);
}
