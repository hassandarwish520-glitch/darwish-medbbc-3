"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

/**
 * Inline, in-app material viewer.
 *
 * Never calls window.open. Never triggers a download. For images the
 * raw bytes are streamed from the secure /api/viewer/:id/:fmt route
 * and rendered in an <img>. For HTML lessons the same route serves the
 * body and we mount it in a sandboxed iframe (no allow-downloads, no
 * allow-popups). For PDFs the route enforces Content-Disposition: inline
 * and the viewer is a PDF.js canvas (kept from the existing component).
 *
 * Web cannot block "view source" completely — what we DO is refuse to
 * expose a download URL or to use Content-Disposition: attachment.
 */
export default function InlineMaterialViewer({
  lessonId,
  url,
  mime,
  label,
  onClose,
}: {
  lessonId: string;
  url: string;
  mime?: string | null;
  label: string;
  onClose: () => void;
}) {
  const effectiveMime = (mime ?? "").toLowerCase();
  const isImage = effectiveMime.startsWith("image/");
  const isPdf = effectiveMime === "application/pdf";
  const isHtml = effectiveMime.includes("html");

  const [htmlSrc, setHtmlSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isHtml) return;
    let alive = true;
    setHtmlSrc(null);
    fetch(url, { cache: "no-store" })
      .then((r) => r.text())
      .then((t) => {
        if (alive) setHtmlSrc(t);
      })
      .catch(() => {
        if (alive) setHtmlSrc("");
      });
    return () => {
      alive = false;
    };
  }, [isHtml, url]);

  const headerLabel = useMemo(() => `Lecture Material • ${label}`, [label]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-2xl border border-ink-800 bg-[#08111d]">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">In-app viewer</div>
          <div className="mt-0.5 text-sm font-semibold text-white">{headerLabel}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/70 px-2 py-1 text-[11px] text-slate-300 transition hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-white">
        {isImage ? (
          <img
            src={url}
            alt={label}
            draggable={false}
            className="block h-full w-full object-contain"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        ) : isPdf ? (
          <iframe
            src={`${url}#toolbar=0&navpanes=0&statusbar=0`}
            sandbox="allow-same-origin allow-scripts"
            className="block h-full w-full"
            title={label}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : isHtml ? (
          htmlSrc === null ? (
            <div className="grid h-full place-items-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <iframe
              srcDoc={htmlSrc || "<!doctype html><p>Empty document.</p>"}
              sandbox="allow-same-origin allow-scripts allow-forms"
              className="block h-full w-full"
              title={label}
              onContextMenu={(e) => e.preventDefault()}
            />
          )
        ) : (
          // Other MIME types — still stream inside the iframe, sandboxed.
          <iframe
            src={url}
            sandbox="allow-same-origin allow-scripts"
            className="block h-full w-full"
            title={label}
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
      </div>
    </div>
  );
}
