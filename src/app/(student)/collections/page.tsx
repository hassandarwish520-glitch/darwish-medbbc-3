"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, FileText, Play, Search, Package } from "lucide-react";

type Collection = {
  id: string;
  title: string;
  kind: string | null;
  course_id: string | null;
  question_count: number;
  created_at: string;
};

function kindIcon(kind: string | null) {
  if (kind === "pdf") return <FileText className="h-5 w-5" />;
  if (kind === "html-file" || kind === "html-inline") return <FileText className="h-5 w-5" />;
  return <Package className="h-5 w-5" />;
}

function kindLabel(kind: string | null) {
  if (kind === "pdf") return "PDF";
  if (kind === "html-file" || kind === "html-inline") return "Document";
  return "Collection";
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => {
        setCollections(d.collections ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load collections");
        setLoading(false);
      });
  }, []);

  const filtered = collections.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-shell pb-32 sm:pb-24">
      {/* Header */}
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <div className="mb-1 flex items-center gap-2" style={{ color: "var(--c-brand)" }}>
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.18em]">Question Banks</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>
          Collections
        </h1>
        <p className="mt-2 text-base leading-7" style={{ color: "var(--c-text-3)" }}>
          Question banks imported from your study documents — run as a full quiz session.
        </p>

        {/* Search */}
        <div
          className="mt-6 flex items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--c-text-4)" }} />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
            style={{ color: "var(--c-text-1)" }}
            placeholder="Search collections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-[20px] animate-pulse"
                style={{ background: "var(--c-card)" }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border p-6 text-center"
            style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}
          >
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-[24px] border p-10 text-center"
            style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}
          >
            <Package className="mx-auto h-10 w-10 mb-3" style={{ color: "var(--c-text-4)" }} />
            <p className="text-base font-medium" style={{ color: "var(--c-text-2)" }}>
              {search ? "No collections match your search" : "No question banks yet"}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--c-text-4)" }}>
              {!search && "Ask your admin to import documents as question banks."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/qbank?course=${c.course_id ?? ""}&subject=${encodeURIComponent(c.title)}&count=${Math.min(c.question_count, 40)}&mode=tutor`}
                className="group block rounded-[20px] border p-5 transition-all hover:shadow-lg"
                style={{
                  background: "var(--c-card)",
                  borderColor: "var(--c-border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: "var(--c-elevated)", color: "var(--c-brand)" }}
                  >
                    {kindIcon(c.kind)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ background: "var(--c-elevated)", color: "var(--c-text-4)" }}
                      >
                        {kindLabel(c.kind)}
                      </span>
                    </div>
                    <h3
                      className="mt-1 text-base font-semibold leading-6 truncate"
                      style={{ color: "var(--c-text-1)" }}
                    >
                      {c.title}
                    </h3>
                    <p className="mt-0.5 text-sm" style={{ color: "var(--c-text-3)" }}>
                      {c.question_count} question{c.question_count !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition group-hover:opacity-100"
                      style={{
                        background: "var(--c-brand)",
                        color: "#fff",
                        opacity: 0.85,
                      }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </div>
                    <ChevronRight
                      className="h-4 w-4"
                      style={{ color: "var(--c-text-4)" }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats footer */}
        {!loading && !error && filtered.length > 0 && (
          <p className="mt-6 text-center text-xs" style={{ color: "var(--c-text-4)" }}>
            {filtered.length} collection{filtered.length !== 1 ? "s" : ""} ·{" "}
            {filtered.reduce((s, c) => s + c.question_count, 0).toLocaleString()} total questions
          </p>
        )}
      </div>
    </div>
  );
}
