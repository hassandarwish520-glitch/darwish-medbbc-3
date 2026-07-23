"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react";

export default function LessonViewer({ id, kind }: { id: string; kind: string }) {
  if (kind === "pdf") return <PdfViewer id={id} />;
  return <HtmlViewer id={id} />;
}

function HtmlViewer({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <div className="card overflow-hidden">
      {loading && (
        <div className="p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading lesson…
        </div>
      )}
      {failed && (
        <div className="p-6 text-sm text-red-300 flex items-start gap-3 border-b border-ink-700 bg-red-500/5">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            Unable to load the HTML lesson. Try refreshing the page or re-upload the document from Admin → Documents.
          </div>
        </div>
      )}
      <iframe
        src={`/api/viewer/${id}/html`}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        className={`w-full ${loading ? "hidden" : "block"} min-h-[80vh] bg-white rounded-2xl`}
        onLoad={() => {
          setLoading(false);
          setFailed(false);
        }}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
    </div>
  );
}

function PdfViewer({ id }: { id: string }) {
  const src = useMemo(() => `/api/viewer/${id}/pdf#toolbar=1&navpanes=0&view=FitH`, [id]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [src, key]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-ink-700 text-sm">
        <div className="text-slate-400">Internal PDF viewer optimized for large files.</div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={() => setKey((v) => v + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
          <a className="btn-ghost text-xs" href={src} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>

      {loading && (
        <div className="p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PDF…
        </div>
      )}

      {failed && (
        <div className="p-6 text-sm text-red-300 flex items-start gap-3 bg-red-500/5 border-t border-ink-700">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            The PDF did not load inside the embedded viewer. Use <span className="font-semibold">Open</span> to view it directly in the browser while keeping the file protected through the internal route.
          </div>
        </div>
      )}

      <iframe
        key={key}
        src={src}
        className={`w-full min-h-[85vh] bg-white ${loading ? "hidden" : "block"}`}
        onLoad={() => {
          setLoading(false);
          setFailed(false);
        }}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        title="PDF lesson viewer"
      />
    </div>
  );
}
