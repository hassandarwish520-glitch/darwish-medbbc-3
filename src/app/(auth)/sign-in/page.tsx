"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr(error.message);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand">✚ DarwishMedBBC</h1>
        </div>
        <div className="flex gap-2 mb-4 bg-ink-800 rounded-full p-1">
          <button className="flex-1 py-2 rounded-full bg-ink-700 text-white text-sm font-medium">Sign In</button>
          <Link href="/sign-up" className="flex-1 py-2 rounded-full text-slate-400 text-sm text-center">Create Account</Link>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Welcome back</h2>
            <p className="text-sm text-slate-400">Sign in to continue your study session</p>
          </div>

          <div>
            <label className="label">Email address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input className="input pl-9" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@institution.edu" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link href="#" className="text-xs text-brand">Forgot password?</Link>
            </div>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input className="input pl-9 pr-9" type={show ? "text" : "password"} required
                value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          New to DarwishMedBBC?{" "}
          <Link href="/sign-up" className="text-brand">Create a free account</Link>
        </p>
      </div>
    </main>
  );
}
