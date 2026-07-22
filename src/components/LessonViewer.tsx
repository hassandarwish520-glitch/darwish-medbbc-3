"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search } from "lucide-react";

export default function LessonViewer({ id, kind }: { id: string; kind: string }) {
  if (kind === "pdf") return <PdfViewer id={id} />;
  return <HtmlViewer id={id} />;
}

// -------- HTML: proxied through /api/viewer to hide storage --------
function HtmlViewer({ id }: { id: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  return (
    <div className="card overflow-hidden">
      {loading && (
        <div className="p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading lesson…
        </div>
      )}
      <iframe
        ref={ref}
        src={`/api/viewer/${id}/html`}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        className={`w-full ${loading ? "hidden" : "block"} min-h-[80vh] bg-white rounded-2xl`}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}

// -------- PDF: lightweight built-in viewer with zoom + paging + search --------
function PdfViewer({ id }: { id: string }) {
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ page: number; snippet: string }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc =
        (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      const task = pdfjs.getDocument(`/api/viewer/${id}/pdf`);
      const doc = await task.promise;
      if (!cancelled) setPdf(doc);
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    (async () => {
      const p = await pdf.getPage(page);
      const viewport = p.getViewport({ scale });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width; canvas.height = viewport.height;
      await p.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    })();
  }, [pdf, page, scale]);

  async function search() {
    if (!pdf || !q.trim()) { setHits([]); return; }
    const out: { page: number; snippet: string }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const tc = await p.getTextContent();
      const text = tc.items.map((x: any) => x.str).join(" ");
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx >= 0) out.push({ page: i, snippet: text.slice(Math.max(0, idx-40), idx+80) });
    }
    setHits(out);
  }

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-ink-700">
        <button className="btn-ghost" onClick={() => setPage(p => Math.max(1, p-1))}><ChevronLeft className="h-4 w-4"/></button>
        <span className="text-sm">Page {page}{pdf ? ` / ${pdf.numPages}` : ""}</span>
        <button className="btn-ghost" onClick={() => setPage(p => (pdf ? Math.min(pdf.numPages, p+1) : p+1))}><ChevronRight className="h-4 w-4"/></button>
        <div className="mx-2 h-5 w-px bg-ink-700" />
        <button className="btn-ghost" onClick={() => setScale(s => Math.max(0.6, s-0.2))}><ZoomOut className="h-4 w-4"/></button>
        <span className="text-sm">{Math.round(scale*100)}%</span>
        <button className="btn-ghost" onClick={() => setScale(s => Math.min(3, s+0.2))}><ZoomIn className="h-4 w-4"/></button>
        <div className="mx-2 h-5 w-px bg-ink-700" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input className="input pl-9" value={q} onChange={e=>setQ(e.target.value)}
                 onKeyDown={e=>e.key==="Enter" && search()} placeholder="Search in document…" />
        </div>
        <button className="btn-primary" onClick={search}>Search</button>
      </div>

      {hits.length > 0 && (
        <div className="p-3 border-b border-ink-700 max-h-40 overflow-auto text-sm">
          {hits.map((h,i)=>(
            <button key={i} onClick={()=>setPage(h.page)} className="block text-left w-full py-1 hover:text-brand">
              <span className="text-slate-500">p.{h.page}</span> — {h.snippet}…
            </button>
          ))}
        </div>
      )}

      <div className="overflow-auto flex justify-center py-4 bg-ink-950 rounded-b-2xl">
        {!pdf ? <Loader2 className="h-5 w-5 animate-spin text-slate-400"/> : <canvas ref={canvasRef} />}
      </div>
    </div>
  );
}
