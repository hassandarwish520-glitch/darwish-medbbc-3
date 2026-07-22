"use client";
import { useState } from "react";
import { Plus, Video } from "lucide-react";

export default function VideosAdmin({ initial }: { initial: any[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title:"", provider:"youtube", url:"" });

  async function submit() {
    const html = `<!doctype html><html><body style="margin:0;background:#000">
      ${f.provider === "youtube"
        ? `<iframe src="${f.url.replace("watch?v=", "embed/")}" style="width:100%;height:100vh;border:0" allowfullscreen></iframe>`
        : `<a href="${f.url}" target="_blank" style="color:#22d3ee">Open ${f.provider} session</a>`}
    </body></html>`;
    const fd = new FormData();
    fd.set("title", f.title); fd.set("kind","html-inline"); fd.set("html", html);
    fd.set("course_id","");
    const r = await fetch("/api/admin/lessons", { method:"POST", body: fd });
    if (r.ok) {
      const { lesson } = await r.json();
      // Tag it as a video via a follow-up patch
      await fetch("/api/admin/lessons", { method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id: lesson.id, meta: { type: "video", provider: f.provider, url: f.url } }) });
      setRows(r => [{ ...lesson, meta: { type:"video", provider: f.provider }}, ...r]);
      setOpen(false); setF({ title:"", provider:"youtube", url:"" });
    }
  }

  return (
    <>
      <button className="btn-primary mt-4" onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/> Add Video</button>
      <div className="mt-4 space-y-2">
        {rows.map(r => (
          <div key={r.id} className="card p-3 flex items-center gap-3">
            <Video className="h-4 w-4 text-brand"/>
            <div className="flex-1">{r.title}</div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 uppercase">{r.meta?.provider}</span>
          </div>
        ))}
        {!rows.length && <div className="text-slate-500 text-sm">No videos yet.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
          <div className="card p-5 w-full max-w-md space-y-2">
            <h3 className="text-lg font-semibold">New Video</h3>
            <input className="input" placeholder="Title" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/>
            <select className="input" value={f.provider} onChange={e=>setF({...f,provider:e.target.value})}>
              <option value="youtube">YouTube</option><option value="telegram">Telegram</option>
            </select>
            <input className="input" placeholder="URL" value={f.url} onChange={e=>setF({...f,url:e.target.value})}/>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={submit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
