"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

const TRIAL_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

function formatParts(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0"));
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function TrialActivationCards({ activatedAt }: { activatedAt: string }) {
  const trialEndsAt = useMemo(() => new Date(new Date(activatedAt).getTime() + TRIAL_DURATION_MS), [activatedAt]);
  const [remainingMs, setRemainingMs] = useState(() => trialEndsAt.getTime() - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(trialEndsAt.getTime() - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [trialEndsAt]);

  if (!Number.isFinite(trialEndsAt.getTime()) || remainingMs <= 0) return null;

  const [hours, minutes, seconds] = formatParts(remainingMs);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[28px] border p-6 text-center" style={{ background: "var(--c-card)", borderColor: "rgba(52,211,153,0.18)", boxShadow: "var(--shadow-card)" }}>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.16) 0%, rgba(52,211,153,0.06) 72%, transparent 73%)" }}>
          <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(16,185,129,0.14)", color: "#10b981" }}>
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>Your account is approved!</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--c-text-3)" }}>
          Welcome to Darwish MedBBC. You now have full access to the Q-Bank.
        </p>
        <div className="mt-5 space-y-3 text-left">
          {[
            "2-Day Free Trial Activated",
            "Full Q-Bank Access",
            "All Subjects Unlocked",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(15,23,42,0.38)", border: "1px solid rgba(148,163,184,0.10)" }}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-sm" style={{ color: "var(--c-text-2)" }}>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard" className="btn-primary w-full justify-center">
            Go to Dashboard
          </Link>
          <Link href="/qbank" className="btn-ghost w-full justify-center">
            Explore Q-Bank
          </Link>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-left" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.10)" }}>
          <CalendarDays className="h-4 w-4 shrink-0 text-sky-400" />
          <div>
            <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Trial ends on</div>
            <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>{formatDate(trialEndsAt)}</div>
          </div>
        </div>
      </article>

      <article className="rounded-[28px] border p-6 text-center" style={{ background: "var(--c-card)", borderColor: "rgba(251,191,36,0.22)", boxShadow: "var(--shadow-card)" }}>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.05) 72%, transparent 73%)" }}>
          <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>
            <Bell className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>Your trial ends soon</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--c-text-3)" }}>
          Your 2-day free trial will end soon. Subscribe now to continue your access without interruption.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Hours", value: hours },
            { label: "Minutes", value: minutes },
            { label: "Seconds", value: seconds },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl px-3 py-4" style={{ background: "rgba(15,23,42,0.38)", border: "1px solid rgba(148,163,184,0.10)" }}>
              <div className="text-2xl font-bold" style={{ color: "var(--c-text-1)" }}>{item.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border px-4 py-4 text-left" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(148,163,184,0.12)" }}>
          <div className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--c-text-4)" }}>Current plan</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold" style={{ color: "var(--c-text-1)" }}>3 Months Plan</div>
              <div className="text-sm" style={{ color: "var(--c-text-3)" }}>$25 / 3 months</div>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: "linear-gradient(90deg, #34d399, #10b981)" }}>
              Best Value
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link href="/" className="btn-primary w-full justify-center">
            Choose a Plan
          </Link>
          <Link href="/" className="btn-ghost w-full justify-center">
            View Plans
          </Link>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--c-text-4)" }}>
          <Clock3 className="h-3.5 w-3.5" />
          Reminder updates automatically every second
        </div>
      </article>
    </section>
  );
}
