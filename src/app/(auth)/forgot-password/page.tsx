"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback?next=/reset-password`;
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password reset email sent. Check your inbox and spam folder, then open the reset link to set a new password.");
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#0B0F1A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand/20 text-brand mb-4">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">Reset your password</h1>
          <p className="text-sm text-slate-400 mt-2">Enter your email and we will send you a secure reset link.</p>
        </div>

        <form onSubmit={submit} className="card p-6 md:p-8 space-y-5 bg-ink-900">
          <div>
            <label className="label">Email address</label>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                className="input pl-11 h-12 bg-ink-800 border-transparent focus:bg-ink-900 focus:border-brand/50"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-400 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">{message}</p> : null}

          <button className="btn-primary w-full h-12 !rounded-xl text-base" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Remembered your password? <Link href="/sign-in" className="text-brand font-medium">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
