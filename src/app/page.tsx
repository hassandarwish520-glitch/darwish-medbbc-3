"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Stethoscope,
  Check,
  Clock,
  BookOpen,
  ChevronDown,
  Star,
  Brain,
  BarChart2,
  Layers,
  Award,
  ArrowRight,
  Users,
  Target,
  Zap,
  Shield,
  PlaySquare,
  MessageCircle,
  Mail,
  TrendingUp,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────── */
const plans = [
  {
    name: "Monthly",
    price: "$10",
    period: "/ month",
    perDay: "$0.33/day",
    features: [
      "Full Q-Bank access",
      "All subjects & topics",
      "Detailed explanations",
      "Progress tracking",
      "Flashcards (SRS)",
    ],
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "3 Months",
    price: "$25",
    period: "/ 3 months",
    perDay: "$0.28/day",
    badge: "Best Value",
    features: [
      "Everything in Monthly",
      "IFOM CSE Simulator",
      "Video lecture library",
      "AI Study Assistant",
      "Priority support",
    ],
    href: "/sign-up",
    highlight: true,
  },
  {
    name: "6 Months",
    price: "$40",
    period: "/ 6 months",
    perDay: "$0.22/day",
    badge: "Max Savings",
    features: [
      "Everything in 3 Months",
      "Unlimited mock exams",
      "1-on-1 study sessions",
      "Early access to new features",
      "Dedicated support channel",
    ],
    href: "/sign-up",
    highlight: false,
    premium: true,
  },
];

const features = [
  {
    icon: <BookOpen className="h-6 w-6" />,
    title: "Smart Q-Bank",
    desc: "Thousands of high-yield questions with detailed explanations, organized by subject and system.",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "Spaced Repetition Flashcards",
    desc: "Science-backed SRS algorithm ensures you review concepts at exactly the right time.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
  },
  {
    icon: <PlaySquare className="h-6 w-6" />,
    title: "Video Lectures",
    desc: "Curated, high-quality video content from expert instructors covering all major topics.",
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
  },
  {
    icon: <Target className="h-6 w-6" />,
    title: "IFOM CSE Simulator",
    desc: "Practice with full-length simulated exams mirroring the real IFOM CSE format.",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
  },
  {
    icon: <BarChart2 className="h-6 w-6" />,
    title: "Performance Analytics",
    desc: "Detailed insights into your strengths and weaknesses across every subject.",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "AI Study Assistant",
    desc: "Get instant explanations and personalized study recommendations powered by AI.",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
  },
];

const testimonials = [
  {
    name: "Ahmad M.",
    role: "USMLE Step 1 Candidate",
    text: "Darwish MedBBC transformed my preparation. The Q-Bank is incredibly detailed and the spaced repetition flashcards are a game changer for long-term retention.",
    stars: 5,
    avatar: "AM",
    avatarColor: "#60a5fa",
  },
  {
    name: "Sara K.",
    role: "MBBS Final Year Student",
    text: "The IFOM CSE Simulator is spot-on. It mirrors the actual exam so well that when I sat the real test, I felt fully prepared. Highly recommended!",
    stars: 5,
    avatar: "SK",
    avatarColor: "#34d399",
  },
  {
    name: "Rami H.",
    role: "Medical Intern",
    text: "Best investment in my medical career. The analytics showed me exactly where I was weak — I improved my score by 18 points in 6 weeks.",
    stars: 5,
    avatar: "RH",
    avatarColor: "#a78bfa",
  },
];

const faqs = [
  {
    q: "What is Darwish MedBBC?",
    a: "Darwish MedBBC is a professional medical education platform designed for USMLE and MBBS students. It offers a comprehensive Q-Bank, spaced-repetition flashcards, video lectures, and an IFOM CSE Simulator — all in one place.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! You get a 2-day free trial with no credit card required. You can explore the Q-Bank, flashcards, and platform features before committing to a subscription.",
  },
  {
    q: "How is the Q-Bank organized?",
    a: "Questions are organized by subject, system, and topic. Each question includes a detailed explanation, reference notes, and is tagged for spaced-repetition tracking so you can focus on your weak areas.",
  },
  {
    q: "Can I access the platform on mobile?",
    a: "Yes. The platform is fully responsive and works seamlessly on all devices — desktop, tablet, and mobile. Study anywhere, anytime.",
  },
  {
    q: "What makes the IFOM CSE Simulator different?",
    a: "Our simulator is built to mirror the exact format, difficulty, and timing of the real IFOM CSE exam. It includes full-length timed practice tests with performance breakdowns after each session.",
  },
  {
    q: "How do I get support?",
    a: "You can reach us directly through our Messenger or Telegram channels. Subscribers also have access to the in-platform support chat for quick academic questions.",
  },
];

/* ─────────────────────────────────────────────────────────
   COMPONENTS
───────────────────────────────────────────────────────── */
function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all"
      style={{ borderColor: open ? "rgba(52,211,153,0.40)" : "rgba(255,255,255,0.08)", background: open ? "rgba(52,211,153,0.04)" : "rgba(18,26,43,0.7)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-sm" style={{ color: "var(--c-text-1)" }}>{q}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-300"
          style={{ color: "var(--c-brand)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-7" style={{ color: "var(--c-text-3)" }}>
          {a}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ANIMATED DASHBOARD MOCKUP
───────────────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div
      className="relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden border"
      style={{
        background: "#0f1929",
        borderColor: "rgba(255,255,255,0.10)",
        boxShadow: "0 40px 100px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px rgba(52,211,153,0.08)",
        animation: "float 4s ease-in-out infinite",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0b1220" }}>
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-amber-400/70" />
        <div className="h-3 w-3 rounded-full bg-emerald-400/70" />
        <div className="ml-3 text-xs text-slate-500 font-medium">Darwish MedBBC — Dashboard</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
          <span className="text-[10px] text-emerald-400/70">Live</span>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5 space-y-4">
        {/* Welcome row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Good morning 👋</div>
            <div className="text-base font-bold text-white">Welcome back, Doctor</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
            🔥 7-day streak
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Questions", value: "1,240", color: "#60a5fa", bar: 72 },
            { label: "Accuracy", value: "84%", color: "#34d399", bar: 84 },
            { label: "Flashcards", value: "340", color: "#a78bfa", bar: 56 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3" style={{ background: "#172032" }}>
              <div className="text-[10px] text-slate-400 mb-1">{s.label}</div>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="mt-2 h-1 rounded-full bg-slate-800">
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${s.bar}%`, background: s.color, opacity: 0.7 }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Horizontal lesson carousel preview */}
        <div className="rounded-xl p-4" style={{ background: "#172032" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-slate-300">Continue Studying</div>
            <div className="text-[10px] text-slate-500">← swipe →</div>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[
              { title: "Cardiology", q: "25 Qs", pct: 80, color: "#f87171", new: false },
              { title: "Pharmacology", q: "30 Qs", pct: 40, color: "#f59e0b", new: false },
              { title: "Neurology", q: "20 Qs", pct: 0, color: "#60a5fa", new: true },
            ].map((r) => (
              <div key={r.title} className="flex-shrink-0 rounded-xl p-3 flex flex-col gap-2" style={{ width: "120px", background: "#0f1929", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[11px] font-semibold text-white truncate">{r.title}</div>
                <div className="text-[10px] text-slate-400">{r.q}</div>
                {r.new ? (
                  <span className="text-[10px] font-bold" style={{ color: r.color }}>✦ New</span>
                ) : (
                  <>
                    <div className="h-1 rounded-full bg-slate-800">
                      <div className="h-1 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: r.color }}>{r.pct}%</div>
                  </>
                )}
                <div className="text-[10px] font-semibold mt-auto flex items-center gap-1" style={{ color: r.color }}>
                  {r.new ? "Start" : "Continue"} →
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Continue studying */}
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(96,165,250,0.10))", border: "1px solid rgba(52,211,153,0.20)" }}
        >
          <div>
            <div className="text-[10px] text-slate-400 mb-0.5">Performance</div>
            <div className="text-sm font-semibold text-white">Overall Score: 84%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Top 15% of all students</div>
          </div>
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(52,211,153,0.20)" }}>
            <TrendingUp className="h-4 w-4" style={{ color: "#34d399" }} />
          </div>
        </div>
      </div>

      {/* Glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 60% 0%, rgba(52,211,153,0.06) 0%, transparent 65%)",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scoreIn {
          from { opacity: 0; transform: scale(0.8) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .anim-fade-up { animation: fadeInUp 0.6s ease both; }
        .anim-delay-1 { animation-delay: 0.1s; }
        .anim-delay-2 { animation-delay: 0.2s; }
        .anim-delay-3 { animation-delay: 0.35s; }
        .anim-delay-4 { animation-delay: 0.5s; }
        .anim-delay-5 { animation-delay: 0.65s; }
        .score-card { animation: scoreIn 0.5s ease both; }
        .score-delay-1 { animation-delay: 0.7s; }
        .score-delay-2 { animation-delay: 0.85s; }
      `}</style>

      {/* ── STICKY NAVBAR ── */}
      <header
        className="sticky top-0 z-50 w-full glass-bar"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-xl"
              style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}
            >
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: "var(--c-text-1)" }}>
              Darwish <span style={{ color: "var(--c-brand)" }}>MedBBC</span>
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: "var(--c-text-3)" }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="btn-ghost text-sm px-4 py-2">Sign In</Link>
            <Link href="/sign-up" className="btn-primary text-sm px-4 py-2">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen" style={{ background: "var(--c-bg)" }}>

        {/* ── HERO ── */}
        <section className="relative overflow-hidden px-4 pt-24 pb-20 text-center">
          {/* Background glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(52,211,153,0.14) 0%, transparent 65%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(96,165,250,0.09) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 15% 30%, rgba(167,139,250,0.06) 0%, transparent 50%)",
            }}
          />

          <div className="relative mx-auto max-w-6xl">
            {/* Badge */}
            <div className="anim-fade-up inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium mb-6"
              style={{ borderColor: "var(--c-brand-border)", background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
              <Stethoscope className="h-4 w-4" />
              Professional Medical Education Platform
            </div>

            {/* Headline */}
            <h1 className="anim-fade-up anim-delay-1 text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-tight"
              style={{ color: "var(--c-text-1)" }}>
              Ace Your Medical{" "}
              <span style={{ background: "linear-gradient(135deg, #34d399, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Exams
              </span>
            </h1>

            <p className="anim-fade-up anim-delay-2 mt-6 max-w-xl mx-auto text-base leading-8 sm:text-xl"
              style={{ color: "var(--c-text-3)" }}>
              The all-in-one Q-Bank, flashcards, and video platform for USMLE &amp; MBBS students. Built by doctors, for doctors.
            </p>

            {/* Trust badge */}
            <div className="anim-fade-up anim-delay-3 mt-8 inline-flex items-center gap-3 rounded-full border px-5 py-2.5"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              <div className="flex -space-x-2">
                {["RY","MJ","AM","SK"].map((init, i) => (
                  <div key={i}
                    className="h-7 w-7 rounded-full border-2 grid place-items-center text-[10px] font-bold text-white"
                    style={{ borderColor: "var(--c-bg)", background: ["#34d399","#a78bfa","#60a5fa","#f59e0b"][i] }}>
                    {init}
                  </div>
                ))}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--c-text-2)" }}>
                Trusted by <span className="font-bold" style={{ color: "var(--c-brand)" }}>100+</span> medical students
              </span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
              </div>
            </div>

            {/* Doctor Score Badges */}
            <div className="anim-fade-up anim-delay-4 mt-5 flex flex-wrap items-center justify-center gap-3">
              <div className="score-card score-delay-1 inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5"
                style={{ borderColor: "rgba(52,211,153,0.25)", background: "rgba(52,211,153,0.08)" }}>
                <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #34d399, #10b981)" }}>
                  RY
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold" style={{ color: "var(--c-text-1)" }}>Dr. Rayyan</div>
                  <div className="text-[11px]" style={{ color: "var(--c-text-4)" }}>Scored</div>
                </div>
                <div className="text-xl font-bold" style={{ color: "#34d399" }}>91%</div>
                <TrendingUp className="h-4 w-4" style={{ color: "#34d399" }} />
              </div>

              <div className="score-card score-delay-2 inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5"
                style={{ borderColor: "rgba(96,165,250,0.25)", background: "rgba(96,165,250,0.08)" }}>
                <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #60a5fa, #3b82f6)" }}>
                  MJ
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold" style={{ color: "var(--c-text-1)" }}>Dr. Majd</div>
                  <div className="text-[11px]" style={{ color: "var(--c-text-4)" }}>Scored</div>
                </div>
                <div className="text-xl font-bold" style={{ color: "#60a5fa" }}>83%</div>
                <TrendingUp className="h-4 w-4" style={{ color: "#60a5fa" }} />
              </div>
            </div>

            {/* CTA buttons */}
            <div className="anim-fade-up anim-delay-5 mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/sign-up"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #34d399, #10b981)", boxShadow: "0 8px 32px rgba(52,211,153,0.40)" }}>
                Start 2-Day Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/sign-in" className="btn-ghost text-base px-8 py-4 rounded-2xl">
                Sign In to Your Account
              </Link>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--c-text-4)" }}>
              <Clock className="h-3.5 w-3.5" />
              2-day free trial — no credit card required
            </div>

            {/* Animated dashboard mockup */}
            <div className="mt-16">
              <DashboardMockup />
            </div>
          </div>
        </section>

        {/* ── FEATURE CARDS ── */}
        <section id="features" className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ borderColor: "rgba(96,165,250,0.30)", background: "rgba(96,165,250,0.08)", color: "#60a5fa" }}>
                <Zap className="h-3.5 w-3.5" /> Everything you need
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: "var(--c-text-1)" }}>
                Built for serious medical students
              </h2>
              <p className="mt-3 text-sm sm:text-base max-w-lg mx-auto" style={{ color: "var(--c-text-3)" }}>
                Every tool you need to master your exams, in one cohesive platform.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <div key={f.title}
                  className="card p-6 rounded-3xl group hover:-translate-y-1 transition-all duration-200"
                  style={{ background: "var(--c-card)" }}>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl mb-4 transition-transform group-hover:scale-110"
                    style={{ background: f.bg, color: f.color }}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-base mb-2" style={{ color: "var(--c-text-1)" }}>{f.title}</h3>
                  <p className="text-sm leading-6" style={{ color: "var(--c-text-3)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section className="px-4 py-10">
          <div className="mx-auto max-w-6xl rounded-3xl border p-6 sm:p-10"
            style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.07), rgba(96,165,250,0.05))", borderColor: "rgba(52,211,153,0.20)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {[
                { value: "100+", label: "Active Students", icon: <Users className="h-5 w-5" /> },
                { value: "5,000+", label: "Q-Bank Questions", icon: <BookOpen className="h-5 w-5" /> },
                { value: "84%", label: "Avg. Pass Rate", icon: <Award className="h-5 w-5" /> },
                { value: "2 days", label: "Free Trial", icon: <Shield className="h-5 w-5" /> },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-center mb-2" style={{ color: "var(--c-brand)" }}>{s.icon}</div>
                  <div className="text-3xl font-bold" style={{ color: "var(--c-text-1)" }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--c-text-3)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section id="testimonials" className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ borderColor: "rgba(245,158,11,0.30)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
                <Star className="h-3.5 w-3.5 fill-amber-400" /> Student Reviews
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: "var(--c-text-1)" }}>
                Trusted by students worldwide
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <div key={t.name} className="card p-6 rounded-3xl flex flex-col gap-4 hover:-translate-y-1 transition-all duration-200"
                  style={{ background: "var(--c-card)" }}>
                  <StarRow count={t.stars} />
                  <p className="text-sm leading-7 flex-1" style={{ color: "var(--c-text-2)" }}>"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full grid place-items-center text-xs font-bold text-white shrink-0"
                      style={{ background: t.avatarColor }}>
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>{t.name}</div>
                      <div className="text-xs" style={{ color: "var(--c-text-4)" }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ borderColor: "rgba(167,139,250,0.30)", background: "rgba(167,139,250,0.08)", color: "#a78bfa" }}>
                <Award className="h-3.5 w-3.5" /> Simple Pricing
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: "var(--c-text-1)" }}>
                Invest in your future
              </h2>
              <p className="mt-3 text-sm max-w-sm mx-auto" style={{ color: "var(--c-text-3)" }}>
                Start with a free 2-day trial. No credit card required.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {plans.map((plan) => (
                <div key={plan.name} className="relative rounded-3xl border p-7 flex flex-col group hover:-translate-y-1 transition-all duration-200"
                  style={{
                    background: plan.highlight
                      ? "linear-gradient(135deg, rgba(52,211,153,0.10), rgba(96,165,250,0.07))"
                      : plan.premium
                        ? "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(96,165,250,0.06))"
                        : "var(--c-card)",
                    borderColor: plan.highlight
                      ? "rgba(52,211,153,0.45)"
                      : plan.premium
                        ? "rgba(167,139,250,0.35)"
                        : "var(--c-border)",
                    boxShadow: plan.highlight
                      ? "0 0 50px rgba(52,211,153,0.12)"
                      : plan.premium
                        ? "0 0 40px rgba(167,139,250,0.08)"
                        : "var(--shadow-card)",
                  }}>
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide text-white"
                      style={{ background: plan.highlight ? "linear-gradient(90deg, #34d399, #10b981)" : "linear-gradient(90deg, #a78bfa, #7c3aed)" }}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--c-text-4)" }}>{plan.name}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-5xl font-bold" style={{ color: "var(--c-text-1)" }}>{plan.price}</span>
                    <span className="mb-2 text-sm" style={{ color: "var(--c-text-4)" }}>{plan.period}</span>
                  </div>
                  <div className="text-xs mb-6 font-semibold" style={{ color: plan.highlight ? "#34d399" : plan.premium ? "#a78bfa" : "var(--c-brand)" }}>
                    ≈ {plan.perDay}
                  </div>

                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--c-text-2)" }}>
                        <div className="h-5 w-5 rounded-full grid place-items-center shrink-0"
                          style={{ background: plan.highlight ? "rgba(52,211,153,0.15)" : plan.premium ? "rgba(167,139,250,0.15)" : "rgba(52,211,153,0.15)" }}>
                          <Check className="h-3 w-3" style={{ color: plan.highlight ? "var(--c-brand)" : plan.premium ? "#a78bfa" : "var(--c-brand)" }} />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.href}
                    className="mt-7 block w-full rounded-2xl py-3.5 text-center text-sm font-bold transition hover:-translate-y-0.5"
                    style={plan.highlight ? {
                      background: "linear-gradient(135deg, #34d399, #10b981)",
                      color: "#fff",
                      boxShadow: "0 6px 24px rgba(52,211,153,0.35)",
                    } : plan.premium ? {
                      background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                      color: "#fff",
                      boxShadow: "0 6px 24px rgba(167,139,250,0.30)",
                    } : {
                      border: "1px solid var(--c-border)",
                      background: "var(--c-elevated)",
                      color: "var(--c-text-1)",
                    }}>
                    Start Free Trial
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-xs mt-6" style={{ color: "var(--c-text-4)" }}>
              2-day free trial · Cancel anytime · Secure payment
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="px-4 py-20">
          <div className="mx-auto max-w-2xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: "var(--c-text-1)" }}>
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm" style={{ color: "var(--c-text-3)" }}>
                Everything you need to know about the platform.
              </p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-3xl rounded-3xl p-10 sm:p-14 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(96,165,250,0.10))",
              border: "1px solid rgba(52,211,153,0.25)",
            }}>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4" style={{ color: "var(--c-text-1)" }}>
              Ready to ace your exams?
            </h2>
            <p className="mb-8 text-sm sm:text-base" style={{ color: "var(--c-text-3)" }}>
              Join 100+ students who are already studying smarter.
            </p>
            <Link href="/sign-up"
              className="inline-flex items-center gap-2 rounded-2xl px-10 py-4 text-base font-bold text-white transition hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #34d399, #10b981)", boxShadow: "0 8px 32px rgba(52,211,153,0.40)" }}>
              Start Your Free Trial <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="mt-4 text-xs" style={{ color: "var(--c-text-4)" }}>No credit card required · 2 days free</div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t px-4 py-10" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              {/* Brand */}
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)" }}>
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: "var(--c-text-1)" }}>
                    Darwish <span style={{ color: "var(--c-brand)" }}>MedBBC</span>
                  </div>
                  <div className="text-xs" style={{ color: "var(--c-text-4)" }}>Professional Medical Education</div>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--c-text-3)" }}>
                <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
                <Link href="/sign-up" className="hover:text-white transition-colors">Create Account</Link>
                <a href="#features" className="hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              </div>

              {/* Social */}
              <div className="flex items-center gap-3">
                <a href="https://m.me/61591842446810" target="_blank" rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 hover:border-blue-400/40"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                  title="Messenger">
                  <MessageCircle className="h-4 w-4" style={{ color: "#60a5fa" }} />
                </a>
                <a href="https://t.me/+JDqV-8P07Ec1MmE0" target="_blank" rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 hover:border-sky-400/40"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                  title="Telegram">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#229ED9">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </a>
                <a href="mailto:support@darwishmedbbc.com"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 hover:border-slate-400/40"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                  title="Email">
                  <Mail className="h-4 w-4" style={{ color: "var(--c-text-3)" }} />
                </a>
              </div>
            </div>

            <div className="mt-8 border-t pt-6 text-center text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "var(--c-text-4)" }}>
              © {new Date().getFullYear()} Darwish MedBBC. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
