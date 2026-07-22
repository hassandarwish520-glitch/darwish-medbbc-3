"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignUp() {
  const [form, setForm] = useState({ role: "student", full_name: "", email: "", institution: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("Please accept the Terms and Privacy Policy.");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, institution: form.institution, role: form.role } },
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setOk(true);
  }

  if (ok) return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center">
        <h2 className="text-xl font-semibold">Account created ✓</h2>
        <p className="text-slate-400 mt-2">
          Your account is pending admin activation. You will be notified once an administrator
          activates your access.
        </p>
        <Link href="/sign-in" className="btn-primary mt-6">Back to sign in</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-4 bg-ink-800 rounded-full p-1">
          <Link href="/sign-in" className="flex-1 py-2 rounded-full text-slate-400 text-sm text-center">Sign In</Link>
          <button className="flex-1 py-2 rounded-full bg-ink-700 text-white text-sm font-medium">Create Account</button>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Create your account</h2>
            <p className="text-sm text-slate-400">Start your medical education journey</p>
          </div>

          <div>
            <label className="label">I am a</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["student","educator"] as const).map(r => (
                <button type="button" key={r} onClick={() => set("role", r)}
                  className={`px-3 py-3 rounded-xl border text-left text-sm ${form.role===r ? "border-brand bg-ink-800" : "border-ink-700 bg-ink-900"}`}>
                  <div className="font-medium capitalize">{r}</div>
                  <div className="text-xs text-slate-400">{r==="student"?"USMLE / MBBS prep":"Content management"}</div>
                </button>
              ))}
            </div>
          </div>

          <div><label className="label">Full name</label>
            <input className="input mt-1" required value={form.full_name} onChange={e=>set("full_name", e.target.value)} placeholder="Dr. Ahmed Al-Hassan" /></div>

          <div><label className="label">Institutional email</label>
            <input className="input mt-1" type="email" required value={form.email} onChange={e=>set("email", e.target.value)} placeholder="you@university.edu" /></div>

          <div><label className="label">Institution</label>
            <input className="input mt-1" value={form.institution} onChange={e=>set("institution", e.target.value)} placeholder="King Abdulaziz University — Faculty of Medicine" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Password</label>
              <input className="input mt-1" type="password" required value={form.password} onChange={e=>set("password", e.target.value)} placeholder="Min 8 characters" /></div>
            <div><label className="label">Confirm</label>
              <input className="input mt-1" type="password" required value={form.confirm} onChange={e=>set("confirm", e.target.value)} placeholder="Repeat password" /></div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} className="mt-0.5" />
            <span>I agree to the <span className="text-brand">Terms of Service</span> and <span className="text-brand">Privacy Policy</span></span>
          </label>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating..." : "⊕ Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          Already have an account? <Link href="/sign-in" className="text-brand">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
