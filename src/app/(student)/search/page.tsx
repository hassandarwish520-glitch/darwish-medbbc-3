import Link from "next/link";
import { Search, FileText, Layers, BookOpen, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

function contains(value: string | null | undefined, query: string) {
  return (value || "").toLowerCase().includes(query);
}

function tagText(tags: unknown) {
  return Array.isArray(tags) ? tags.filter(Boolean).join(" ").toLowerCase() : "";
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const s = await createClient();

  const [{ data: lessons }, { data: questions }, { data: flashcards }] = await Promise.all([
    s.from("lessons").select("id,title,kind,meta,visible").eq("visible", true).in("kind", ["html", "pdf", "html-file", "html-inline", "notes", "qbank"]).order("created_at", { ascending: false }).limit(120),
    s.from("questions").select("id,stem,tags,lesson_id").order("created_at", { ascending: false }).limit(120),
    s.from("flashcards").select("id,front,back,tags,lesson_id").order("created_at", { ascending: false }).limit(120),
  ]);

  const lessonResults = query
    ? (lessons ?? []).filter((item: any) => contains(item.title, query) || contains(typeof item.meta?.subject === "string" ? item.meta.subject : "", query) || contains(typeof item.meta?.section === "string" ? item.meta.section : "", query))
    : [];

  const questionResults = query
    ? (questions ?? []).filter((item: any) => contains(item.stem, query) || tagText(item.tags).includes(query))
    : [];

  const flashcardResults = query
    ? (flashcards ?? []).filter((item: any) => contains(item.front, query) || contains(item.back, query) || tagText(item.tags).includes(query))
    : [];

  const total = lessonResults.length + questionResults.length + flashcardResults.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="card border-ink-800 bg-ink-900/80 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Search</h1>
            <p className="mt-1 text-sm text-slate-400">Find matching notes, Q-Bank questions, and flashcards from inside the platform.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-ink-700 bg-[#0b1322] px-4 py-3 text-sm text-slate-200">
          {q.trim() ? <>Showing results for <span className="font-semibold text-white">“{q.trim()}”</span> · {total} match{total === 1 ? "" : "es"}</> : "Use the top search bar to search questions, notes, and flashcards."}
        </div>
      </div>

      {q.trim() ? (
        <div className="mt-6 space-y-6">
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4 text-cyan-300" /> Documents ({lessonResults.length})
            </div>
            <div className="space-y-3">
              {lessonResults.length ? lessonResults.map((item: any) => (
                <Link key={item.id} href={`/lesson/${item.id}`} className="card block border-ink-800 bg-ink-900 p-4 transition hover:border-cyan-400/30">
                  <div className="text-base font-semibold text-white">{item.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-ink-700 px-2 py-0.5 uppercase">{item.kind}</span>
                    {typeof item.meta?.subject === "string" ? <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">{item.meta.subject}</span> : null}
                    {typeof item.meta?.section === "string" ? <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300">{item.meta.section}</span> : null}
                  </div>
                </Link>
              )) : <div className="card border-ink-800 bg-ink-900 p-4 text-sm text-slate-500">No document matches found.</div>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <BookOpen className="h-4 w-4 text-amber-300" /> Q-Bank Questions ({questionResults.length})
            </div>
            <div className="space-y-3">
              {questionResults.length ? questionResults.map((item: any) => {
                const subject = Array.isArray(item.tags) ? item.tags.find((tag: string) => typeof tag === "string" && tag.trim()) : "";
                return (
                  <Link
                    key={item.id}
                    href={subject ? `/qbank?subject=${encodeURIComponent(subject)}&count=20&mode=tutor` : "/qbank"}
                    className="card block border-ink-800 bg-ink-900 p-4 transition hover:border-amber-400/30"
                  >
                    <div className="text-sm leading-7 text-white">{item.stem}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                      {(item.tags ?? []).slice(0, 4).map((tag: string) => (
                        <span key={tag} className="rounded-full border border-ink-700 px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  </Link>
                );
              }) : <div className="card border-ink-800 bg-ink-900 p-4 text-sm text-slate-500">No Q-Bank question matches found.</div>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="h-4 w-4 text-violet-300" /> Flashcards ({flashcardResults.length})
            </div>
            <div className="space-y-3">
              {flashcardResults.length ? flashcardResults.map((item: any) => (
                <Link key={item.id} href="/flashcards" className="card block border-ink-800 bg-ink-900 p-4 transition hover:border-violet-400/30">
                  <div className="text-sm font-semibold text-white">{item.front}</div>
                  <div className="mt-2 line-clamp-3 text-sm leading-7 text-slate-300">{item.back}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    {(item.tags ?? []).slice(0, 4).map((tag: string) => (
                      <span key={tag} className="rounded-full border border-ink-700 px-2 py-0.5">{tag}</span>
                    ))}
                  </div>
                </Link>
              )) : <div className="card border-ink-800 bg-ink-900 p-4 text-sm text-slate-500">No flashcard matches found.</div>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
