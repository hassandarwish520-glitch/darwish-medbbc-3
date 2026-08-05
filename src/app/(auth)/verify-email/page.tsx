"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery"]);

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0B0F1A]" />}>
      <VerifyEmailClient />
    </Suspense>
  );
}

function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const verifyType: EmailOtpType = initialType && ALLOWED_TYPES.has(initialType as EmailOtpType)
    ? (initialType as EmailOtpType)
    : "signup";
  const mode = searchParams.get("mode") === "signin" ? "signin" : "signup";

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback?next=/dashboard`;
  }, []);

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: verifyType,
    });

    setLoading(false);
    if (error) return setErr(error.message);
    router.push("/dashboard?verified=1");
    router.refresh();
  }

  async function resend() {
    if (!email) return setErr("Enter your email address first.");
    setErr(null);
    setMsg(null);
    setResendBusy(true);
    const supabase = createClient();

    let error: { message: string } | null = null;
    if (verifyType === "email") {
      const result = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: redirectTo,
        },
      });
      error = result.error;
    } else if (verifyType === "recovery") {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      error = result.error;
    } else {
      const result = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo },
      });
      error = result.error;
    }

    setResendBusy(false);
    if (error) return setErr(error.message);
    setMsg("Verification email sent. Please check your inbox and spam folder.");
  }

  const intro = verifyType === "email"
    ? mode === "signin"
      ? "Enter the one-time sign-in code from your email. If the email contained a secure link instead, you can click it directly."
      : "Enter the one-time verification code from your email to complete your registration. If the email contained a secure link instead, you can click it directly."
    : "If your email contains a confirmation link, you can click it directly. If it contains a numeric code, enter it here to confirm your account.";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Verify your email</h1>
          <p className="mt-2 text-sm text-slate-400 leading-6">{intro}</p>
        </div>

        <form onSubmit={verifyCode} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@institution.edu" />
          </div>
          <div>
            <label className="label">Verification code</label>
            <input className="input mt-1" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter the code from your email" />
          </div>

          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

          <div className="grid gap-3">
            <button className="btn-primary" disabled={loading}>{loading ? "Verifying..." : "Verify code"}</button>
            <button type="button" className="btn-ghost" disabled={resendBusy} onClick={resend}>
              {resendBusy ? "Sending..." : "Resend verification email"}
            </button>
            <Link href="/sign-in" className="btn-ghost text-center">Back to sign in</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
