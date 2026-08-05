import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ChevronLeft, FileText, PlaySquare } from "lucide-react";
import BookmarkButton from "@/components/BookmarkButton";
import StudyWorkspace from "@/components/StudyWorkspace";
import { createAdminClient, createClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LessonMeta = {
  type?: string;
  provider?: string;
  notes?: string;
  index_text?: string;
  document_path?: string;
  document_name?: string;
  document_mime?: string;
  url?: string;
} | null;

function assetHref(path: string) {
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function AttachmentPreview({ meta, isVideo }: { meta: LessonMeta; isVideo: boolean }) {
  if (!meta?.document_path) return null;
  const href = assetHref(meta.document_path);
  const mime = meta.document_mime || "";
  const name = meta.document_name || "Attached file";

  return (
    <section className="card protected-view mt-6 overflow-hidden border-ink-800 bg-ink-900">
      <div className="border-b border-ink-800 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {isVideo ? "Study file below the video" : "Attached study file"}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">{name}</h2>
            <p className="mt-2 text-sm text-slate-400">
              The file is shown fully inside the platform directly under the session.
            </p>
          </div>
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            Full in-app view
          </div>
        </div>
      </div>

      {mime.startsWith("image/") ? (
        <img
          src={href}
          alt={name}
          className="block w-full bg-ink-950 select-none"
          draggable={false}
        />
      ) : mime === "application/pdf" ? (
        <div
          className="relative select-none"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <iframe
            src={`${href}#toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`}
            className="block min-h-[105vh] w-full bg-white"
            title={name}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      ) : (
        <iframe
          src={href}
          className="block min-h-[95vh] w-full bg-white"
          title={name}
        />
      )}
    </section>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireActive();
  if (!ctx) notFound();

  const canPreviewHidden = isAdminProfile(ctx.profile);
  const db = canPreviewHidden ? createAdminClient() : await createClient();
  const { data: lesson } = await db.from("lessons").select("*").eq("id", id).single();
  if (!lesson || (!lesson.visible && !canPreviewHidden)) notFound();

  const meta = (lesson.meta ?? null) as LessonMeta;
  const isVideo = meta?.type === "video";
  const externalUrl = typeof meta?.url === "string" ? meta.url : "";
  const provider = typeof meta?.provider === "string" ? meta.provider : "";

  return (
    <div className="page-shell max-w-5xl pb-10">
      <Link
        href={isVideo ? "/videos" : "/courses"}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <section className="card mt-4 overflow-hidden border-ink-800 bg-ink-900">
        <div className={`h-1.5 w-full ${isVideo ? "bg-gradient-to-r from-fuchsia-500 via-brand to-cyan-400" : "bg-gradient-to-r from-cyan-500 via-brand to-emerald-400"}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-ink-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {isVideo ? "Video session" : `${lesson.kind} lesson`}
                </span>
                {provider ? (
                  <span className="rounded-full border border-ink-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {provider}
                  </span>
                ) : null}
                {!lesson.visible && canPreviewHidden ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-300">
                    Hidden preview
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">{lesson.title}</h1>

              <div className="mt-4 flex flex-wrap gap-3">
                {externalUrl ? (
                  <Link href={externalUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                    <ExternalLink className="h-4 w-4" /> {provider === "telegram" ? "Open in Telegram" : "Open external session"}
                  </Link>
                ) : null}
                <div className="btn-ghost text-sm">
                  {isVideo ? <PlaySquare className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {meta?.document_path ? "File included below" : "Internal lesson view"}
                </div>
              </div>
            </div>

            <BookmarkButton lessonId={lesson.id} />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <StudyWorkspace
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lessonKind={lesson.kind}
          lessonMeta={(lesson.meta ?? null) as Record<string, unknown> | null}
          subjectSlug={typeof (lesson.meta as Record<string, unknown> | null)?.subject === "string" ? ((lesson.meta as Record<string, unknown>).subject as string) : null}
          externalAttachment={meta?.document_path ? {
            href: assetHref(meta.document_path),
            mime: meta.document_mime || "",
            name: meta.document_name || "Attached file",
          } : null}
          sessionUrl={externalUrl || null}
        />
      </section>

    </div>
  );
}
