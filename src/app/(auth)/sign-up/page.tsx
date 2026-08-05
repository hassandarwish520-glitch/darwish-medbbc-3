"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Clock } from "lucide-react";

const PLANS = [
  { name: "1 Month", price: "$10", period: "/ month", highlight: false },
  { name: "3 Months", price: "$25", period: "/ 3 months", badge: "Best Value", highlight: true },
];

export default function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({
    role: "student",
    full_name: "",
    email: "",
    institution: "",
    password: "",
    confirm: "",
  });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okEmail, setOkEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!form.full_name.trim()) return setErr("Full name is required.");
    if (!form.email.trim()) return setErr("Email is required.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    if (!agree) return setErr("Please accept the Terms and Privacy Policy.");

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        institution: form.institution.trim(),
        role: form.role,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      return setErr(payload?.error || "Sign up failed. Please try again.");
    }

    setOkEmail(form.email);
    setTimeout(() => {
      router.push(`/sign-in?created=1&email=${encodeURIComponent(form.email)}`);
      router.refresh();
    }, 1500);
  }

  if (okEmail)
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold">Account created ✓</h2>
          <p className="text-slate-300 leading-7">
            Your account for <span className="text-white font-medium">{okEmail}</span> was created successfully.
            An administrator will review and activate your access to the course content shortly.
          </p>
          <p className="text-slate-400 text-sm">
            You can sign in at any time. If your access is still pending, you will see a waiting screen until the admin activates you.
          </p>
          <div className="grid gap-3">
            <Link href={`/sign-in?created=1&email=${encodeURIComponent(okEmail)}`} className="btn-primary">
              Go to sign in
            </Link>
          </div>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen flex items-center justify-center p-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 rounded-2xl border border-ink-700 bg-ink-900 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            2-day free trial included
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-3 text-center ${
                  plan.highlight ? "border-brand/50 bg-brand/10" : "border-ink-700 bg-ink-800"
                }`}
              >
                {plan.badge ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {plan.badge}
                  </span>
                ) : null}
                <div className="text-xs text-slate-400">{plan.name}</div>
                <div className="mt-1 text-2xl font-bold text-white">{plan.price}</div>
                <div className="text-[11px] text-slate-500">{plan.period}</div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {["Full Q-Bank access", "All subjects & topics", "Detailed explanations"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="h-3 w-3 shrink-0 text-emerald-400" /> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 mb-4 bg-ink-800 rounded-full p-1">
          <Link href="/sign-in" className="flex-1 py-2 rounded-full text-slate-400 text-sm text-center">Sign In</Link>
          <button className="flex-1 py-2 rounded-full bg-ink-700 text-white text-sm font-medium">Create Account</button>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Create your free account</h2>
            <p className="text-sm text-slate-400">No email verification needed. After creating your account, an admin will activate your access to the course.</p>
          </div>

          <div>
            <label className="label">I am a</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { value: "student", label: "Student", desc: "USMLE / MBBS prep" },
                { value: "educator", label: "Instructor", desc: "Content management" },
              ] as const).map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => set("role", r.value)}
                  className={`px-3 py-3 rounded-xl border text-left text-sm ${form.role === r.value ? "border-brand bg-ink-800" : "border-ink-700 bg-ink-900"}`}
                >
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-slate-400">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div><label className="label">Full name</label><input className="input mt-1" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Dr. Ahmed Al-Hassan" /></div>
          <div><label className="label">Email</label><input className="input mt-1" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@university.edu" /></div>
          <div><label className="label">Institution</label><input className="input mt-1" value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="King Abdulaziz University — Faculty of Medicine" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Password</label><input className="input mt-1" type="password" required value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 8 characters" /></div>
            <div><label className="label">Confirm</label><input className="input mt-1" type="password" required value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Repeat password" /></div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>I agree to the <span className="text-brand">Terms of Service</span> and <span className="text-brand">Privacy Policy</span></span>
          </label>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating..." : "⊕ Create Free Account"}</button>
        </form>
      </div>
    </main>
  );
}
