"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";

const STEP_ITEMS = [
  { id: 1, title: "Create Account", subtitle: "Quick and secure sign up" },
  { id: 2, title: "Academic Information", subtitle: "Tell us about your background" },
  { id: 3, title: "Choose Plan", subtitle: "Start your 2-day free trial" },
] as const;

const PLAN_OPTIONS: ReadonlyArray<{
  id: string;
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  badge?: string;
}> = [
  { id: "1_month", name: "1 Month Plan", price: "$10", period: "/ month", highlight: false },
  { id: "3_months", name: "3 Months Plan", price: "$25", period: "/ 3 months", badge: "Best Value", highlight: true },
];

const PREPARATION_TYPES = [
  "USMLE",
  "IFOM",
  "MBBS",
  "Medical School Exams",
  "Residency Preparation",
  "Other",
] as const;

const CURRENT_LEVEL_GROUPS = [
  {
    label: "Medical Student",
    options: [
      "Medical Student — Year 1",
      "Medical Student — Year 2",
      "Medical Student — Year 3",
      "Medical Student — Year 4",
      "Medical Student — Year 5",
      "Medical Student — Year 6",
    ],
  },
  {
    label: "Clinical / Postgraduate",
    options: [
      "Intern / House Officer",
      "Medical Graduate",
      "Resident",
      "Practicing Physician",
      "Other",
    ],
  },
] as const;

const PURPOSE_OPTIONS = [
  "Q-Bank study and question practice",
  "Exam preparation (USMLE / IFOM / MBBS)",
  "Medical school revision",
  "Clinical knowledge refresh",
  "Other academic purpose",
] as const;

type FormState = {
  role: "student";
  full_name: string;
  email: string;
  password: string;
  confirm: string;
  institution: string;
  preparation_type: string;
  current_level: string;
  purpose_of_access: string;
  selected_plan: string;
};

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState<FormState>({
    role: "student",
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    institution: "",
    preparation_type: "",
    current_level: "",
    purpose_of_access: "",
    selected_plan: "3 Months Plan",
  });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okEmail, setOkEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectedPlan = useMemo(
    () => PLAN_OPTIONS.find((plan) => plan.name === form.selected_plan) ?? PLAN_OPTIONS[1],
    [form.selected_plan]
  );

  function validateStep1() {
    if (!form.full_name.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    return null;
  }

  function validateStep2() {
    if (!form.institution.trim()) return "Institution / University is required.";
    if (!form.preparation_type.trim()) return "Exam / Preparation Type is required.";
    if (!form.current_level.trim()) return "Current level is required.";
    if (!form.purpose_of_access.trim()) return "Purpose of access is required.";
    return null;
  }

  function goNext() {
    setErr(null);
    if (step === 1) {
      const message = validateStep1();
      if (message) return setErr(message);
      return setStep(2);
    }
    if (step === 2) {
      const message = validateStep2();
      if (message) return setErr(message);
      return setStep(3);
    }
  }

  function goBack() {
    setErr(null);
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const step1Error = validateStep1();
    if (step1Error) {
      setStep(1);
      return setErr(step1Error);
    }

    const step2Error = validateStep2();
    if (step2Error) {
      setStep(2);
      return setErr(step2Error);
    }

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
        preparation_type: form.preparation_type,
        current_level: form.current_level,
        purpose_of_access: form.purpose_of_access,
        selected_plan: form.selected_plan,
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
    }, 1600);
  }

  if (okEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-lg p-8 text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold">Registration submitted</h2>
          <p className="text-slate-300 leading-7">
            Your account for <span className="text-white font-medium">{okEmail}</span> was created successfully and sent for review.
          </p>
          <p className="text-slate-400 text-sm leading-6">
            An administrator will verify your academic information, approve your access, and activate your 2-day free trial once the review is complete.
          </p>
          <Link href={`/sign-in?created=1&email=${encodeURIComponent(okEmail)}`} className="btn-primary w-full justify-center">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {STEP_ITEMS.map((item) => {
            const active = step === item.id;
            const complete = step > item.id;
            return (
              <div key={item.id} className="rounded-2xl border px-4 py-4" style={{ background: active ? "rgba(15,23,42,0.88)" : "rgba(15,23,42,0.58)", borderColor: active || complete ? "rgba(20,184,166,0.35)" : "rgba(51,65,85,0.65)" }}>
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: active || complete ? "linear-gradient(90deg, #14b8a6, #22c55e)" : "rgba(148,163,184,0.18)", color: "white" }}>
                    {item.id}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.subtitle}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={submit} className="card rounded-[30px] p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-white">{STEP_ITEMS[step - 1].title}</h1>
                <p className="mt-1 text-sm text-slate-400">{STEP_ITEMS[step - 1].subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((dot) => (
                  <span
                    key={dot}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: dot <= step + 1 ? "#14b8a6" : "rgba(148,163,184,0.35)" }}
                  />
                ))}
              </div>
            </div>

            {step === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full Name" icon={<User className="h-4 w-4" />}>
                    <input className="input pl-10" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Enter your full name" />
                  </Field>
                  <Field label="Email Address" icon={<Mail className="h-4 w-4" />}>
                    <input className="input pl-10" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Enter your email" />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordField
                    label="Password"
                    value={form.password}
                    onChange={(value) => set("password", value)}
                    placeholder="Min 8 characters"
                    visible={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                  />
                  <PasswordField
                    label="Confirm Password"
                    value={form.confirm}
                    onChange={(value) => set("confirm", value)}
                    placeholder="Repeat your password"
                    visible={showConfirm}
                    onToggle={() => setShowConfirm((value) => !value)}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-slate-300" style={{ borderColor: "rgba(148,163,184,0.18)", background: "rgba(255,255,255,0.02)" }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
                  <span>
                    I agree to the <span className="text-brand">Terms of Service</span> and <span className="text-brand">Privacy Policy</span>.
                  </span>
                </label>

                <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: "rgba(20,184,166,0.18)", background: "rgba(20,184,166,0.07)", color: "#cbd5e1" }}>
                  <div className="flex items-center gap-2 font-medium text-white">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Your data is encrypted and secure.
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <Field label="Institution / University" icon={<Building2 className="h-4 w-4" />}>
                  <input className="input pl-10" value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="Search or enter your institution" />
                </Field>

                <SelectField
                  label="Exam / Preparation Type"
                  value={form.preparation_type}
                  onChange={(value) => set("preparation_type", value)}
                  placeholder="Select your exam or goal"
                  helper="Examples: USMLE, IFOM, MBBS, Medical School"
                  options={PREPARATION_TYPES}
                />

                <div>
                  <label className="label">Current Level</label>
                  <select className="input mt-1" value={form.current_level} onChange={(e) => set("current_level", e.target.value)}>
                    <option value="">Select your current level</option>
                    {CURRENT_LEVEL_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">Year of study / Residency / Physician etc.</p>
                </div>

                <SelectField
                  label="Purpose of Access"
                  value={form.purpose_of_access}
                  onChange={(value) => set("purpose_of_access", value)}
                  placeholder="Select your purpose"
                  helper="For security and proper access review"
                  options={PURPOSE_OPTIONS}
                />

                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: "rgba(20,184,166,0.18)", background: "rgba(20,184,166,0.07)" }}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "#34d399" }}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Your information is confidential.</div>
                      <p className="mt-1 text-xs leading-6 text-slate-400">
                        We use this information only to verify your registration and provide access to the correct content.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: "rgba(20,184,166,0.18)", background: "rgba(20,184,166,0.07)" }}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    <Clock className="h-3.5 w-3.5" />
                    2-Day Free Trial Included
                  </div>
                </div>

                <div className="space-y-3">
                  {PLAN_OPTIONS.map((plan) => {
                    const active = form.selected_plan === plan.name;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => set("selected_plan", plan.name)}
                        className="w-full rounded-2xl border px-4 py-4 text-left transition"
                        style={{
                          borderColor: active ? "rgba(20,184,166,0.55)" : "rgba(148,163,184,0.15)",
                          background: active ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-1 h-4 w-4 rounded-full border" style={{ borderColor: active ? "#14b8a6" : "rgba(148,163,184,0.5)", boxShadow: active ? "inset 0 0 0 4px #14b8a6" : "none" }} />
                            <div>
                              <div className="text-sm font-semibold text-white">{plan.name}</div>
                              <div className="mt-1 text-3xl font-bold text-white">{plan.price}</div>
                              <div className="text-xs text-slate-400">{plan.period}</div>
                            </div>
                          </div>
                          {plan.badge ? (
                            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: "linear-gradient(90deg, #10b981, #14b8a6)" }}>
                              {plan.badge}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <ul className="space-y-2">
                  {[
                    "Full Q-Bank access",
                    "All subjects & topics",
                    "Detailed explanations",
                    "Secure & ad-free experience",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="rounded-2xl border px-4 py-4 text-sm text-slate-300" style={{ borderColor: "rgba(148,163,184,0.15)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2 text-white font-medium">
                    <GraduationCap className="h-4 w-4 text-sky-400" />
                    Registration summary
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div><span className="text-slate-500">Institution:</span> {form.institution}</div>
                    <div><span className="text-slate-500">Preparation:</span> {form.preparation_type}</div>
                    <div><span className="text-slate-500">Current Level:</span> {form.current_level}</div>
                    <div><span className="text-slate-500">Selected Plan:</span> {selectedPlan.name}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {err ? <p className="text-sm text-red-400">{err}</p> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-400">
                Already have an account? <Link href="/sign-in" className="text-brand">Sign in</Link>
              </div>
              <div className="flex gap-3 sm:justify-end">
                {step > 1 ? (
                  <button type="button" onClick={goBack} className="btn-ghost">
                    Back
                  </button>
                ) : null}
                {step < 3 ? (
                  <button type="button" onClick={goNext} className="btn-primary">
                    Continue
                  </button>
                ) : (
                  <button className="btn-primary" disabled={loading}>
                    {loading ? "Submitting..." : "Submit for Review"}
                  </button>
                )}
              </div>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-[30px] border p-6" style={{ background: "rgba(15,23,42,0.88)", borderColor: "rgba(148,163,184,0.14)" }}>
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "rgba(20,184,166,0.12)", color: "#14b8a6" }}>
                  <GraduationCap className="h-8 w-8" />
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">MEDICAL Q-BANK</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">Darwish MedBBC</p>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  "Secure registration review",
                  "Protected Q-Bank access",
                  "Admin approval before activation",
                  "2-day free trial after approval",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.10)" }}>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border p-6" style={{ background: "rgba(15,23,42,0.72)", borderColor: "rgba(148,163,184,0.14)" }}>
              <div className="text-sm font-semibold text-white">Selected Plan</div>
              <div className="mt-3 rounded-2xl border px-4 py-4" style={{ borderColor: "rgba(20,184,166,0.22)", background: "rgba(20,184,166,0.08)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">{selectedPlan.name}</div>
                    <div className="mt-1 text-3xl font-bold text-white">{selectedPlan.price}</div>
                    <div className="text-xs text-slate-400">{selectedPlan.period}</div>
                  </div>
                  {selectedPlan.badge ? (
                    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: "linear-gradient(90deg, #10b981, #14b8a6)" }}>
                      {selectedPlan.badge}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-xs leading-6 text-slate-400">
                You won’t be charged during the trial. Access becomes active only after admin approval.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative mt-1">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-10 pr-11"
          type={visible ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helper: string;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
