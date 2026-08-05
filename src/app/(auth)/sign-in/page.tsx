"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff, Stethoscope } from "lucide-react";
import MessengerWidget from "@/components/MessengerWidget";

export default function SignInPage() {
  return (
    <>
      <Suspense fallback={<SignInSkeleton />}>
        <SignInClient />
      </Suspense>
      <MessengerWidget />
    </>
  );
}

function SignInClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useMemo(() => {
    const prefill = searchParams.get("email");
    if (prefill && !email) setEmail(prefill);
  }, [searchParams, email]);

  const notice = useMemo(() => {
    if (searchParams.get("created") === "1") {
      return "Account created successfully. If your access is still pending, an admin will activate it shortly.";
    }
    if (searchParams.get("reset") === "1") {
      return "Password updated successfully. You can sign in now with your new password.";
    }
    const authError = searchParams.get("authError");
    if (authError) return decodeURIComponent(authError);
    return null;
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(error.message);
    // Full page reload ensures the new session cookie is sent with the next request
    window.location.href = "/dashboard";
  }

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center p-6"
      style={{ background: "var(--c-bg)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl mb-4"
            style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
          >
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight leading-tight"
            style={{ color: "var(--c-text-1)" }}
          >
            MEDICAL Q-BANK
          </h1>
          <p
            className="text-xs uppercase font-semibold tracking-[0.2em] mt-1"
            style={{ color: "var(--c-brand)" }}
          >
            Darwish MedBBC
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex gap-2 mb-6 rounded-2xl p-1 border"
          style={{
            background: "var(--c-elevated)",
            borderColor: "var(--c-border)",
          }}
        >
          <button
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition"
            style={{ background: "var(--c-card)", color: "var(--c-text-1)" }}
          >
            Sign In
          </button>
          <Link
            href="/sign-up"
            className="flex-1 py-2.5 rounded-xl text-sm text-center font-medium transition"
            style={{ color: "var(--c-text-3)" }}
          >
            Create Account
          </Link>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="card p-6 md:p-8 space-y-4"
          style={{ background: "var(--c-card)" }}
        >
          {notice ? (
            <p
              className="text-sm p-3 rounded-xl border"
              style={{
                color: "var(--c-brand)",
                background: "var(--c-brand-bg)",
                borderColor: "var(--c-brand-border)",
              }}
            >
              {notice}
            </p>
          ) : null}

          <div>
            <label className="label">Email address</label>
            <div className="relative mt-2">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5"
                style={{ color: "var(--c-text-4)" }}
              />
              <input
                className="input pl-11 h-12"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@institution.edu"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium"
                style={{ color: "var(--c-brand)" }}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-2">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5"
                style={{ color: "var(--c-text-4)" }}
              />
              <input
                className="input pl-11 pr-11 h-12"
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition"
                style={{ color: "var(--c-text-4)" }}
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {err ? <p className="text-sm text-red-400">{err}</p> : null}

          <button className="btn-primary w-full h-12 text-base mt-2" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p
          className="text-center text-sm mt-6"
          style={{ color: "var(--c-text-4)" }}
        >
          New to Darwish MedBBC?{" "}
          <Link href="/sign-up" className="font-medium" style={{ color: "var(--c-brand)" }}>
            Create a free account
          </Link>
        </p>
      </div>
    </main>
  );
}

function SignInSkeleton() {
  return (
    <main
      className="min-h-[100dvh]"
      style={{ background: "var(--c-bg)" }}
    />
  );
}
