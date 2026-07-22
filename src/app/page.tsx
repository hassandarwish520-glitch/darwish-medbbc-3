import Link from "next/link";
import { Stethoscope } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
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
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link href="/sign-in" className="btn-primary flex-1">Sign In</Link>
        <Link href="/sign-up" className="btn-ghost flex-1">Create Account</Link>
      </div>
    </main>
  );
}
