"use client";
import { useState } from "react";
import { Plus, Video } from "lucide-react";

type Row = {
  id: string;
  title: string;
  meta?: { type?: string; provider?: string; url?: string; index_text?: string } | null;
  course_id?: string | null;
};

type Course = { id: string; title: string };

function toYouTubeEmbed(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : trimmed;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function buildVideoHtml(provider: string, url: string, title: string) {
  const safeUrl = url.trim();
  const embedUrl = provider === "youtube" ? toYouTubeEmbed(safeUrl) : safeUrl;
  const canEmbed = provider === "youtube";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,Arial,sans-serif}
      .wrap{min-height:100vh;display:flex;flex-direction:column;gap:16px;padding:16px}
      .card{background:#0f172a;border:1px solid #1e293b;border-radius:18px;overflow:hidden}
      .meta{padding:16px}
      .embed{position:relative;width:100%;padding-top:56.25%;background:#000}
      .embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
      .cta{display:inline-flex;align-items:center;gap:8px;background:#22d3ee;color:#082f49;padding:10px 14px;border-radius:999px;text-decoration:none;font-weight:700}
      .fallback{padding:28px}
      p{margin:8px 0 0;color:#94a3b8}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card meta">
        <h1 style="margin:0;font-size:22px">${title}</h1>
        <p>${provider.toUpperCase()} session</p>
      </div>
      <div class="card">
        ${canEmbed ? `<div class="embed"><iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : `<div class="fallback"><a class="cta" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open ${provider} session</a><p>This provider opens in a secure new tab from inside the lesson viewer.</p></div>`}
      </div>
    </div>
  </body>
</html>`;
}

export default function VideosAdmin({ initial, courses }: { initial: Row[]; courses: Course[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", provider: "youtube", url: "", course_id: "", notes: "" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.title.trim() || !f.url.trim()) return;
    setBusy(true);
    const html = buildVideoHtml(f.provider, f.url, f.title);
    const fd = new FormData();
    fd.set("title", f.title);
    fd.set("kind", "html-inline");
    fd.set("html", html);
    fd.set("course_id", f.course_id);
    if (f.notes.trim()) fd.set("index_text", f.notes.trim());
    fd.set(
      "meta",
      JSON.stringify({ type: "video", provider: f.provider, url: f.url, ...(f.notes.trim() ? { notes: f.notes.trim() } : {}) })
    );

    const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
    setBusy(false);
    if (r.ok) {
      const { lesson } = await r.json();
      setRows((list) => [lesson, ...list]);
      setOpen(false);
      setF({ title: "", provider: "youtube", url: "", course_id: "", notes: "" });
    }
  }

  return (
    <>
      <button className="btn-primary mt-4" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Video Session
      </button>
      <div className="mt-3 text-xs text-slate-500">You can attach notes/transcript so AI Tutor can use the session in RAG answers.</div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="card p-3 flex items-center gap-3">
            <Video className="h-4 w-4 text-brand" />
            <div className="flex-1">
              <div>{row.title}</div>
              {row.meta?.url && <div className="text-xs text-slate-500 line-clamp-1">{row.meta.url}</div>}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 uppercase">{row.meta?.provider}</span>
            {row.meta?.index_text && <span className="text-xs px-2 py-0.5 rounded-full bg-brand/20 text-brand">RAG</span>}
          </div>
        ))}
        {!rows.length && <div className="text-slate-500 text-sm">No video sessions yet.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
          <div className="card p-5 w-full max-w-xl space-y-3">
            <h3 className="text-lg font-semibold">New Video Session</h3>
            <input className="input" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className="input" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
                <option value="youtube">YouTube</option>
                <option value="telegram">Telegram</option>
                <option value="zoom">Zoom</option>
                <option value="custom">Custom</option>
              </select>
              <select className="input" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                <option value="">— No course —</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <input className="input" placeholder="Session URL" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
            <textarea
              className="input h-28"
              placeholder="Session transcript / summary / notes for AI Tutor RAG"
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
