"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/sign-in?reset=1");
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#0B0F1A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand/20 text-brand mb-4">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">Create a new password</h1>
          <p className="text-sm text-slate-400 mt-2">Choose a new password for your account, then sign in again.</p>
        </div>

        <form onSubmit={submit} className="card p-6 md:p-8 space-y-5 bg-ink-900">
          <div>
            <label className="label">New password</label>
            <div className="relative mt-2">
              <input
                className="input pr-11 h-12 bg-ink-800 border-transparent focus:bg-ink-900 focus:border-brand/50"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirm password</label>
            <div className="relative mt-2">
              <input
                className="input pr-11 h-12 bg-ink-800 border-transparent focus:bg-ink-900 focus:border-brand/50"
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400 font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p> : null}

          <button className="btn-primary w-full h-12 !rounded-xl text-base" disabled={loading}>
            {loading ? "Saving..." : "Save new password"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/sign-in" className="text-brand font-medium">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
