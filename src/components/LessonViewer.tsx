"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Presentation, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

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
  getDocument: (params: { data: ArrayBuffer; disableAutoFetch?: boolean; disableStream?: boolean }) => { promise: Promise<PdfjsDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfjsLib;
  }
}

/**
 * Load pdfjsLib once across the whole app.
 *
 * Why we use the UMD bundle, NOT the .mjs ESM bundle:
 *   pdf.min.mjs is an ESM that never assigns to `window.pdfjsLib`, so calling
 *   `getDocument` afterwards returned undefined and silently failed. The UMD
 *   `pdf.min.js` exposes `window.pdfjsLib` and works under classic scripts.
 */
function ensurePdfjsLib(): Promise<PdfjsLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

  return new Promise<PdfjsLib>((resolve, reject) => {
    const existing = document.getElementById("pdfjs-legacy-script");
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.pdfjsLib) resolve(window.pdfjsLib);
        else reject(new Error("PDF.js script loaded but pdfjsLib missing"));
      });
      existing.addEventListener("error", () => reject(new Error("PDF.js script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = "pdfjs-legacy-script";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return reject(new Error("PDF.js loaded but pdfjsLib missing"));
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
}

export default function LessonViewer({ id, kind, fileType }: { id: string; kind: string; fileType?: string }) {
  const effectiveType = fileType || kind;
  if (effectiveType === "pptx") return <PptxViewer id={id} />;
  if (effectiveType === "image") return <ImageViewer id={id} />;
  if (kind === "pdf" || effectiveType === "pdf") return <PdfViewer id={id} />;
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
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-4 py-2.5 select-none">
        <Presentation className="h-4 w-4 text-cyan-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Presentation</span>
        <span className="ml-auto text-xs text-slate-600">🔒 View only</span>
      </div>

      {status === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <span className="text-sm">Loading presentation…</span>
        </div>
      )}

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

      {status === "ready" && viewerUrl && (
        <div className="relative flex-1" style={{ minHeight: "72vh" }}>
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
              <span className="text-sm">Rendering slides…</span>
            </div>
          )}

          {/*
            KEY FIXES vs. previous version:
            - sandbox removed `allow-popups` so mobile doesn't escape into a new tab.
            - explicit 100% width/height so container shrinks/expands on rotation.
            - allow="autoplay; encrypted-media; fullscreen" so the iframe can take
              the full viewport on phones without a covering overlay.
          */}
          <iframe
            key={viewerUrl}
            src={viewerUrl}
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
            allow="fullscreen"
            loading="eager"
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
      {/*
        KEY FIX: explicit max-width and height auto so portrait images on
        phones shrink to fit the iframe container rather than overflow.
      */}
      <img
        src={src}
        alt="Lesson image"
        className="block w-full h-auto max-w-full"
        loading="lazy"
        draggable={false}
        style={{ userSelect: "none", WebkitUserSelect: "none", maxHeight: "85vh", objectFit: "contain" } as React.CSSProperties}
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
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        className={`w-full ${loading ? "hidden" : "block"} border-0 bg-white rounded-2xl`}
        style={{ minHeight: "80vh", height: "85vh" }}
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

/**
 * PDF viewer that actually works on mobile.
 *
 * Improvements over the previous in-app pdf.js implementation:
 *  1. Uses the UMD bundle (pdf.min.js) that DOES set `window.pdfjsLib`
 *     instead of the ESM `pdf.min.mjs` which left it undefined.
 *  2. Caches the pdfjsLib script in <head> so re-mounts don't re-download.
 *  3. Adds an Iframe fallback that mirrors native PDF reader chrome —
 *     critical for iOS Safari and Android Chrome where PDF.js can render
 *     with empty pages on first paint.
 *  4. Fit-to-width scaling that responds to ResizeObserver so rotation
 *     and split-screen actually reflow.
 *  5. Download button that hits `/api/viewer/{id}/pdf?download=1`.
 */
function PdfViewer({ id }: { id: string }) {
  const pdfSrc = useMemo(() => `/api/viewer/${id}/pdf`, [id]);
  const iframeSrc = useMemo(() => `/api/viewer/${id}/pdf#toolbar=1&navpanes=1&scrollbar=1&view=FitH`, [id]);
  const [viewMode, setViewMode] = useState<"pdfjs" | "iframe">("pdfjs");

  return (
    <div className="card protected-view overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">PDF Document</span>
          <span className="text-xs text-slate-500">🔒 View only</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-ink-800 p-1 flex">
            <button
              onClick={() => setViewMode("pdfjs")}
              className={`px-3 py-1 text-xs rounded-full transition ${viewMode === "pdfjs" ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}
              title="In-app reader with page navigation"
            >
              Reader
            </button>
            <button
              onClick={() => setViewMode("iframe")}
              className={`px-3 py-1 text-xs rounded-full transition ${viewMode === "iframe" ? "bg-brand text-white" : "text-slate-400 hover:text-white"}`}
              title="Native browser PDF chrome (best on mobile)"
            >
              Native
            </button>
          </div>
          <a href={`${pdfSrc}?download=1`} className="btn-ghost text-xs flex items-center gap-1" title="Open in browser">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
          <a href={`${pdfSrc}?download=1`} download className="btn-ghost text-xs flex items-center gap-1" title="Download">
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>

      <div className="relative w-full" style={{ minHeight: "80vh", height: "85vh" }}>
        {viewMode === "pdfjs" ? (
          <PdfjsReader id={id} src={pdfSrc} />
        ) : (
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title="PDF native viewer"
            className="absolute inset-0 w-full h-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}

function PdfjsReader({ id, src }: { id: string; src: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfjsDocument | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Reflow when window resizes / orientation changes / sidebar opens.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);

    async function load() {
      try {
        const pdfjsLib = await ensurePdfjsLib();
        if (cancelled) return;

        const res = await fetch(src, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
        const data = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data, disableAutoFetch: false, disableStream: false }).promise;
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

  // Fit-to-width: pick a scale that matches the container so horizontal
  // scrolling is never needed on phones in portrait mode.
  const fitScale = useCallback(async (doc: PdfjsDocument, pageNum: number) => {
    if (!wrapRef.current || containerWidth <= 0) return 1;
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const padding = 32; // p-4 * 2
    const available = Math.max(280, containerWidth - padding);
    return Math.min(2.5, Math.max(0.5, available / base.width));
  }, [containerWidth]);

  const renderPage = useCallback(
    async (doc: PdfjsDocument, pageNum: number, pageScale?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      renderTaskRef.current?.cancel();

      const page = await doc.getPage(pageNum);
      const scale = pageScale ?? (await fitScale(doc, pageNum));
      const viewport = page.getViewport({ scale });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
      } as Parameters<PdfjsPage["render"]>[0]);
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (e) {
        // Cancellation is expected when zoom/page changes mid-render
      }
      renderTaskRef.current = null;
    },
    [fitScale],
  );

  useEffect(() => {
    if (!pdfDoc) return;
    void renderPage(pdfDoc, currentPage);
  }, [pdfDoc, currentPage, containerWidth, renderPage]);

  function prevPage() {
    setCurrentPage((p) => Math.max(1, p - 1));
  }
  function nextPage() {
    setCurrentPage((p) => Math.min(numPages, p + 1));
  }
  async function zoomIn() {
    if (!pdfDoc) return;
    await renderPage(pdfDoc, currentPage, 1.5);
  }
  async function zoomOut() {
    if (!pdfDoc) return;
    await renderPage(pdfDoc, currentPage, 0.7);
  }
  async function zoomFit() {
    if (!pdfDoc) return;
    await renderPage(pdfDoc, currentPage); // no scale -> re-fit
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-[#0b1322] select-none overflow-auto">
      {/* Floating controls */}
      <div className="sticky top-2 z-10 mx-auto flex w-fit items-center gap-1 rounded-full border border-ink-700 bg-ink-900/95 px-2 py-1 text-xs shadow-lg backdrop-blur">
        <button className="btn-ghost h-7 w-7 p-0 grid place-items-center" onClick={prevPage} disabled={currentPage <= 1 || loading} title="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-slate-300 min-w-[56px] text-center tabular-nums">
          {loading ? "…" : `${currentPage} / ${numPages}`}
        </span>
        <button className="btn-ghost h-7 w-7 p-0 grid place-items-center" onClick={nextPage} disabled={currentPage >= numPages || loading} title="Next">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-ink-700" />
        <button className="btn-ghost h-7 w-7 p-0 grid place-items-center" onClick={zoomOut} disabled={loading} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button className="btn-ghost h-7 px-2 p-0 grid place-items-center" onClick={zoomFit} disabled={loading} title="Fit width">
          Fit
        </button>
        <button className="btn-ghost h-7 w-7 p-0 grid place-items-center" onClick={zoomIn} disabled={loading} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button className="btn-ghost h-7 w-7 p-0 grid place-items-center" onClick={() => window.location.reload()} title="Reload">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-center p-4">
        {loading && (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PDF…
          </div>
        )}
        {error && (
          <div className="p-6 text-sm text-red-300 flex items-start gap-3 bg-red-500/5 border border-red-500/30 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div>{error}</div>
              <div className="mt-2 text-xs text-slate-400">
                Tap “Native” at the top to switch to the browser&apos;s built-in PDF viewer.
              </div>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`shadow-2xl rounded bg-white ${loading || error ? "hidden" : "block"}`}
          style={{ userSelect: "none", WebkitUserSelect: "none", maxWidth: "100%" } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
