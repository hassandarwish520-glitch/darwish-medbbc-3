"use client";
import { useState } from "react";
import { FileText, FileType2, Eye, EyeOff, Trash2, Upload, PencilLine, Globe } from "lucide-react";

type Lesson = { id: string; title: string; kind: string; visible: boolean; course_id: string | null; meta: any };
type Course = { id: string; title: string };

export default function DocumentsClient({ initial, courses }: { initial: Lesson[]; courses: Course[] }) {
  const [rows, setRows] = useState<Lesson[]>(initial);
  const [tab, setTab] = useState<"all"|"html"|"pdf">("all");
  const [modal, setModal] = useState<null | "html-page" | "html-file" | "pdf">(null);

  const shown = rows.filter(r => tab === "all" || r.kind === tab);

  async function toggle(l: Lesson) {
    const r = await fetch("/api/admin/lessons", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id: l.id, visible: !l.visible }) });
    if (r.ok) setRows(rs => rs.map(x => x.id===l.id ? { ...x, visible: !l.visible } : x));
  }
  async function remove(l: Lesson) {
    if (!confirm(`Delete "${l.title}"?`)) return;
    const r = await fetch("/api/admin/lessons?id="+l.id, { method:"DELETE" });
    if (r.ok) setRows(rs => rs.filter(x => x.id !== l.id));
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={()=>setModal("html-page")} className="btn-ghost"><PencilLine className="h-4 w-4"/> Write HTML Page</button>
        <button onClick={()=>setModal("html-file")} className="btn-ghost"><Globe className="h-4 w-4"/> Upload HTML File</button>
        <button onClick={()=>setModal("pdf")}       className="btn-primary"><Upload className="h-4 w-4"/> Upload PDF</button>
      </div>

      <div className="flex gap-2 mt-4 text-sm">
        {(["all","html","pdf"] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className={`px-3 py-1 rounded-full ${tab===t ? "bg-brand text-ink-950" : "bg-ink-800 text-slate-300"}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map(l => {
          const I = l.kind === "pdf" ? FileType2 : FileText;
          return (
            <div key={l.id} className="card p-3 flex items-center gap-3">
              <I className="h-5 w-5 text-brand" />
              <div className="flex-1">
                <div className="font-medium">{l.title}</div>
                <div className="text-xs text-slate-500 uppercase">{l.kind}</div>
              </div>
              <button className="btn-ghost text-xs" onClick={()=>toggle(l)}>
                {l.visible ? <><Eye className="h-3 w-3"/> Visible</> : <><EyeOff className="h-3 w-3"/> Hidden</>}
              </button>
              <button className="btn-ghost text-xs" onClick={()=>remove(l)}><Trash2 className="h-3 w-3"/></button>
            </div>
          );
        })}
        {!shown.length && <div className="text-center text-slate-500 py-10">No documents yet.</div>}
      </div>

      {modal && <UploadModal kind={modal} courses={courses} onClose={()=>setModal(null)}
        onCreated={(l: Lesson)=>{ setRows(rs=>[l,...rs]); setModal(null); }} />}
    </>
  );
}

function UploadModal({ kind, courses, onClose, onCreated }:
  { kind: "html-page"|"html-file"|"pdf"; courses: Course[]; onClose: ()=>void; onCreated: (l: Lesson)=>void }) {
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState<string>("");
  const [html, setHtml]   = useState("");
  const [file, setFile]   = useState<File | null>(null);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("course_id", course);
      if (kind === "html-page") { fd.set("kind","html-inline"); fd.set("html", html); }
      else if (kind === "html-file") { fd.set("kind","html-file"); if (file) fd.set("file", file); }
      else { fd.set("kind","pdf"); if (file) fd.set("file", file); }
      const r = await fetch("/api/admin/lessons", { method:"POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const { lesson } = await r.json();
      onCreated(lesson);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
      <div className="card p-5 w-full max-w-lg">
        <h3 className="text-lg font-semibold">
          {kind==="html-page" ? "New HTML lesson page"
           : kind==="html-file" ? "Upload HTML file"
           : "Upload PDF"}
        </h3>
        <div className="mt-3 space-y-3">
          <div><label className="label">Title</label>
            <input className="input mt-1" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Lesson title"/></div>
          <div><label className="label">Course (optional)</label>
            <select className="input mt-1" value={course} onChange={e=>setCourse(e.target.value)}>
              <option value="">— none —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select></div>

          {kind==="html-page" && (
            <div><label className="label">HTML content (CSS/JS preserved)</label>
              <textarea className="input mt-1 h-64 font-mono text-xs" value={html} onChange={e=>setHtml(e.target.value)}
                placeholder="<html>…</html>"/></div>
          )}
          {kind!=="html-page" && (
            <div><label className="label">File</label>
              <input className="input mt-1" type="file"
                accept={kind==="pdf" ? "application/pdf" : "text/html,.html,.htm"}
                onChange={e=>setFile(e.target.files?.[0] ?? null)}/></div>
          )}
          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
