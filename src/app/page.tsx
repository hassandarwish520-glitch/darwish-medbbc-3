import Link from "next/link";
import { Stethoscope, Check, Clock, BookOpen } from "lucide-react";

const plans = [
  {
    name: "Monthly",
    price: "$10",
    period: "/ month",
    features: ["Full Q-Bank access", "All subjects & topics", "Detailed explanations", "Progress tracking"],
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "3 Months",
    price: "$25",
    period: "/ 3 months",
    badge: "Best Value",
    features: ["Full Q-Bank access", "All subjects & topics", "Detailed explanations", "Progress tracking"],
    href: "/sign-up",
    highlight: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 text-center">
      {/* Hero */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ink-800 border border-ink-700 text-brand text-sm">
        <Stethoscope className="h-4 w-4" /> Professional Medical Education
      </div>
      <h1 className="mt-6 text-5xl sm:text-6xl font-bold tracking-tight">
        Darwish <span className="text-brand">Med BBC</span>
      </h1>
      <p className="mt-4 max-w-xl text-slate-400">
        A professional medical training platform connecting students with expert instructors
        through structured, approved course enrollments.
      </p>

      {/* Free trial badge */}
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-300">
        <Clock className="h-4 w-4" />
        2-day free trial — no credit card required
      </div>

      {/* Pricing cards */}
      <div className="mt-10 grid w-full max-w-lg gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-2xl border p-6 text-left transition ${
              plan.highlight
                ? "border-brand/60 bg-brand/10 shadow-[0_0_32px_rgba(79,140,255,0.12)]"
                : "border-ink-700 bg-ink-900"
            }`}
          >
            {plan.badge ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white shadow">
                {plan.badge}
              </span>
            ) : null}
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{plan.name}</div>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-bold text-white">{plan.price}</span>
              <span className="mb-1 text-sm text-slate-400">{plan.period}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href={plan.href} className={`mt-5 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition ${plan.highlight ? "bg-brand text-white hover:bg-brand/90" : "border border-ink-600 bg-ink-800 text-white hover:bg-ink-700"}`}>
              Start Free Trial
            </Link>
          </div>
        ))}
      </div>

      {/* Auth buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link href="/sign-in" className="btn-primary flex-1">Sign In</Link>
        <Link href="/sign-up" className="btn-ghost flex-1">Create Account</Link>
      </div>

      {/* Feature pills */}
      <div className="mt-10 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5">
          <BookOpen className="h-3.5 w-3.5 text-brand" /> Q-Bank
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-400" /> Flashcards
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-cyan-400" /> IFOM CSE Simulator
        </span>
      </div>
    </main>
  );
}
