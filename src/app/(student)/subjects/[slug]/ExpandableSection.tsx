"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ExpandableSectionProps {
  colorClass: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  meta?: string;
  cta: string;
  ctaHref: string;
  sectionKey: string;
  children: React.ReactNode;
}

export default function ExpandableSection({
  colorClass,
  icon,
  title,
  count,
  meta,
  cta,
  ctaHref,
  children,
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-3xl border border-ink-800 bg-ink-900 overflow-hidden">
      {/* Header row — click to expand */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-ink-800/40 transition"
      >
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl ${colorClass} shrink-0`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-white">{title}</div>
          {meta && (
            <div className="mt-0.5 text-xs text-slate-400">{meta}</div>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-sm font-bold text-white">
            {count}
          </span>
          <svg
            className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      {/* CTA always visible */}
      <div className="px-5 pb-4 flex items-center gap-3">
        {count > 0 ? (
          <Link
            href={ctaHref}
            className="btn-primary text-sm py-1.5 px-4 inline-flex items-center gap-1.5"
          >
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="rounded-2xl border border-ink-700 bg-ink-950/40 px-4 py-1.5 text-sm text-slate-500">
            Nothing yet
          </span>
        )}
        {count > 0 && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
      </div>

      {/* Expandable content */}
      {expanded && count > 0 && (
        <div className="border-t border-ink-800 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
