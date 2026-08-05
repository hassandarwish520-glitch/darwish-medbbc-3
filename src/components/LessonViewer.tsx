"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Presentation, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

interface PdfjsViewport {
  width: number;
  height: number;
}

interface PdfjsRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

interface PdfjsPage {
  getViewport: (params: { scale: number }) => PdfjsViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => PdfjsRenderTask;
}

interface PdfjsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPage>;
}

interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfjsDocument> };
}

export default function LessonViewer({ id, kind, fileType }: { id: string; kind: string; fileType?: string }) {
  const effectiveType = fileType || kind;
  if (effectiveType === "pptx") return <PptxViewer id={id} />;
  if (effectiveType === "image") return <ImageViewer id={id} />;
  if (kind === "pdf") return <PdfViewer id={id} />;
  return <HtmlViewer id={id} />;
}

function PptxViewer({ id }: { id: string }) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [iframeLoaded, setIframeLoaded] = useState(false);

  function loadViewer() {
    setStatus("loading");
    setViewerUrl(null);
    setIframeLoaded(false);

    fetch(`/api/viewer/${id}/pptx-signed`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load presentation");
        return r.json() as Promise<{ viewerUrl?: string; error?: string }>;
      })
      .then((data) => {
        if (data.viewerUrl) {
          setViewerUrl(data.viewerUrl);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }

  useEffect(() => {
    loadViewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="card protected-view overflow-hidden flex flex-col" style={{ minHeight: "80vh" }}>
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-4 py-2.5 select-none">
        <Presentation className="h-4 w-4 text-cyan-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Presentation</span>
        <span className="ml-auto text-xs text-slate-600">🔒 View only</span>
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <span className="text-sm">Loading presentation…</span>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-slate-400">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <span className="text-sm text-red-400">Could not load presentation. Please try again.</span>
          <button
            className="mt-2 rounded-lg bg-ink-800 px-4 py-2 text-xs text-slate-300 hover:bg-ink-700 transition"
            onClick={loadViewer}
          >
            Retry
          </button>
        </div>
      )}

      {/* Viewer */}
      {status === "ready" && viewerUrl && (
        <div className="relative flex-1" style={{ minHeight: "72vh" }}>
          {/* Spinner while Google renders the first slide */}
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              <span className="text-sm">Rendering slides…</span>
            </div>
          )}

          {/* The Google Docs Viewer iframe — no covering overlay so navigation arrows are clickable */}
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title="Presentation Viewer"
          />
        </div>
      )}
    </div>
  );
}

function ImageViewer({ id }: { id: string }) {
  const src = `/api/viewer/${id}/image`;
  return (
    <div
      className="card protected-view overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <img
        src={src}
        alt="Lesson image"
        className="block w-full"
        draggable={false}
        style={{ userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
      />
    </div>
  );
}

function HtmlViewer({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <div className="card protected-view overflow-hidden">
      {loading && (
        <div className="p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading lesson…
        </div>
      )}
      {failed && (
        <div className="p-6 text-sm text-red-300 flex items-start gap-3 border-b border-ink-700 bg-red-500/5">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>Unable to load the HTML lesson. Try refreshing the page or re-upload the document from Admin → Documents.</div>
        </div>
      )}
      <iframe
        src={`/api/viewer/${id}/html`}
        sandbox="allow-same-origin allow-scripts allow-forms"
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

/** Renders a PDF using the browser's native canvas via PDF.js loaded from CDN. */
function PdfViewer({ id }: { id: string }) {
  const src = useMemo(() => `/api/viewer/${id}/pdf`, [id]);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfjsDocument | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Load PDF.js from CDN and then load the document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);

    async function load() {
      try {
        // Dynamically load PDF.js from CDN if not already loaded
        const win = window as unknown as Record<string, unknown>;
        let pdfjsLib = win.pdfjsLib as PdfjsLib | undefined;
        if (!pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
            script.type = "module";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load PDF.js"));
            document.head.appendChild(script);
          });
          pdfjsLib = win.pdfjsLib as PdfjsLib | undefined;
        }

        if (!pdfjsLib) throw new Error("PDF.js not available");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [src]);

  const renderPage = useCallback(
    async (doc: PdfjsDocument, pageNum: number, pageScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      renderTaskRef.current?.cancel();

      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: pageScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!pdfDoc) return;
    void renderPage(pdfDoc, currentPage, scale);
  }, [pdfDoc, currentPage, scale, renderPage]);

  function prevPage() {
    setCurrentPage((p) => Math.max(1, p - 1));
  }
  function nextPage() {
    setCurrentPage((p) => Math.min(numPages, p + 1));
  }
  function zoomIn() {
    setScale((s) => Math.min(3, s + 0.25));
  }
  function zoomOut() {
    setScale((s) => Math.max(0.5, s - 0.25));
  }

  return (
    <div
      className="card protected-view overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost h-8 w-8 p-0 grid place-items-center"
            onClick={prevPage}
            disabled={currentPage <= 1 || loading}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-slate-400 text-xs min-w-[64px] text-center">
            {loading ? "…" : `${currentPage} / ${numPages}`}
          </span>
          <button
            className="btn-ghost h-8 w-8 p-0 grid place-items-center"
            onClick={nextPage}
            disabled={currentPage >= numPages || loading}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-ghost h-8 w-8 p-0 grid place-items-center" onClick={zoomOut} disabled={loading} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-slate-400 text-xs min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          <button className="btn-ghost h-8 w-8 p-0 grid place-items-center" onClick={zoomIn} disabled={loading} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button className="btn-ghost text-xs flex items-center gap-1" onClick={() => window.location.reload()} title="Reload">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PDF…
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-6 text-sm text-red-300 flex items-start gap-3 bg-red-500/5 border-t border-ink-700">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Canvas */}
      <div className={`overflow-auto p-4 flex justify-center bg-[#0b1322] ${loading || error ? "hidden" : "block"}`}>
        <canvas
          ref={canvasRef}
          className="shadow-2xl rounded"
          style={{ userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
