"use client";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FileText, Link2, Paperclip, Plus, Trash2, Video } from "lucide-react";

type Row = {
  id: string;
  title: string;
  kind?: string;
  visible?: boolean;
  meta?: {
    type?: string;
    provider?: string;
    url?: string;
    index_text?: string;
    notes?: string;
    document_path?: string;
    document_name?: string;
    document_mime?: string;
  } | null;
  course_id?: string | null;
};

type Course = { id: string; title: string };

type FormState = { title: string; provider: string; url: string; course_id: string; notes: string };
const EMPTY_FORM: FormState = { title: "", provider: "youtube", url: "", course_id: "", notes: "" };

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
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,Arial,sans-serif}.wrap{min-height:100vh;display:flex;flex-direction:column;gap:16px;padding:16px}.card{background:#0f172a;border:1px solid #1e293b;border-radius:18px;overflow:hidden}.meta{padding:16px}.embed{position:relative;width:100%;padding-top:56.25%;background:#000}.embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.fallback{padding:28px}.hint{margin-top:10px;color:#94a3b8;line-height:1.6}p{margin:8px 0 0;color:#94a3b8}</style></head><body><div class="wrap"><div class="card meta"><h1 style="margin:0;font-size:22px">${title}</h1><p>${provider.toUpperCase()} session</p></div><div class="card">${canEmbed ? `<div class="embed"><iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : `<div class="fallback"><div class="hint">This provider cannot be embedded directly. Save the transcript / notes below and use the attached document inside the platform.</div></div>`}</div></div></body></html>`;
}

function validateUrl(url: string) { try { const parsed = new URL(url.trim()); return parsed.protocol === "https:" || parsed.protocol === "http:"; } catch { return false; } }
function providerLabel(provider: string) { return provider === "custom" ? "Video" : provider.charAt(0).toUpperCase() + provider.slice(1); }
function suggestTitle(form: FormState, courses: Course[]) { if (form.title.trim()) return form.title.trim(); const courseTitle = courses.find((course) => course.id === form.course_id)?.title; const label = providerLabel(form.provider); if (courseTitle) return `${courseTitle} • ${label} session`; return `${label} session`; }

async function uploadAttachment(file: File) {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("folder", "attachments");
  const r = await fetch("/api/admin/uploads", { method: "POST", body: fd });
  const payload = await r.json();
  if (!r.ok) throw new Error(payload?.error || "Failed to upload attachment");
  return payload as { path: string; url: string; type: string; name: string };
}

function assetHref(path?: string) { if (!path) return ""; return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`; }

export default function VideosAdmin({ initial, courses }: { initial: Row[]; courses: Course[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const courseName = useMemo(() => Object.fromEntries(courses.map((course) => [course.id, course.title])), [courses]);

  async function submit() {
    setErr(null); setOk(null);
    if (!f.url.trim()) return setErr("Video link is required.");
    if (!validateUrl(f.url)) return setErr("Please enter a valid video URL starting with http:// or https://.");
    setBusy(true);
    try {
      const finalTitle = suggestTitle(f, courses);
      const html = buildVideoHtml(f.provider, f.url, finalTitle);
      const fd = new FormData();
      fd.set("title", finalTitle);
      fd.set("kind", "html-inline");
      fd.set("html", html);
      if (f.course_id) fd.set("course_id", f.course_id);
      if (f.notes.trim()) fd.set("index_text", f.notes.trim());
      const meta: Record<string, unknown> = { type: "video", provider: f.provider, url: f.url.trim(), ...(f.notes.trim() ? { notes: f.notes.trim() } : {}) };
      if (attachment) {
        const uploaded = await uploadAttachment(attachment);
        meta.document_path = uploaded.path;
        meta.document_name = uploaded.name;
        meta.document_mime = uploaded.type;
      }
      fd.set("meta", JSON.stringify(meta));
      const r = await fetch("/api/admin/lessons", { method: "POST", body: fd });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error((payload && typeof payload.error === "string" && payload.error) || "Failed to save video session.");
      const saved = payload.lesson as Row;
      const deduped = Boolean(payload?.deduped);
      setRows((list) => list.some((item) => item.id === saved.id) ? list : [saved, ...list]);
      setOk(deduped ? "This video already exists, so the existing saved session was reused without duplication." : "Video session saved successfully and will appear immediately without page reload.");
      setOpen(false); setF(EMPTY_FORM); setAttachment(null);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save video session."); }
    finally { setBusy(false); }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete \"${row.title}\"?`)) return;
    const r = await fetch(`/api/admin/lessons?id=${row.id}`, { method: "DELETE" });
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(payload?.error || "Failed to delete video session."); return; }
    setRows((list) => list.filter((item) => item.id !== row.id));
    setOk("Video session deleted successfully.");
  }

  return (<><button className="btn-primary mt-4" onClick={() => { setOpen(true); setErr(null); setOk(null); }}><Plus className="h-4 w-4" /> Add Video Session</button><div className="mt-3 text-xs text-slate-500">Add the video link once, optionally attach a file below it, and include notes that can be used directly by the Tutor and exam mode.</div>{ok && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {ok}</div>}{err && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {err}</div>}<div className="mt-4 space-y-2">{rows.map((row) => (<div key={row.id} className="card p-3 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex items-start gap-3 flex-1 min-w-0"><Video className="h-4 w-4 text-brand mt-1 shrink-0" /><div className="min-w-0 flex-1"><div className="font-medium truncate">{row.title}</div>{row.meta?.url && <div className="text-xs text-slate-500 line-clamp-1 break-all">{row.meta.url}</div>}<div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase">{row.meta?.provider && <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">{row.meta.provider}</span>}{row.course_id && courseName[row.course_id] && <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 normal-case">{courseName[row.course_id]}</span>}{row.meta?.notes && <span className="px-2 py-0.5 rounded-full bg-brand/20 text-brand">Indexed</span>}{row.meta?.document_path && <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">Attachment</span>}</div></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><a className="btn-ghost text-xs" href={`/lesson/${row.id}`}><Eye className="h-3 w-3" /> Open</a>{row.meta?.document_path && (<a className="btn-ghost text-xs" href={assetHref(row.meta.document_path)}><FileText className="h-3 w-3" /> Attachment</a>)}<button className="btn-ghost text-xs" onClick={() => void remove(row)}><Trash2 className="h-3 w-3" /> Delete</button></div></div>))}{!rows.length && <div className="card p-8 text-center text-slate-500 text-sm">No video sessions yet.</div>}</div>{open && (<div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4"><div className="card p-5 w-full max-w-xl space-y-3"><h3 className="text-lg font-semibold">New Video Session</h3><input className="input" placeholder="Title (optional)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><select className="input" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="youtube">YouTube</option><option value="telegram">Telegram</option><option value="zoom">Zoom</option><option value="custom">Custom</option></select><select className="input" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}><option value="">— No course —</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div><div className="relative"><Link2 className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" /><input className="input pl-9" placeholder="https://..." value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></div><textarea className="input h-28" placeholder="Session transcript / summary / notes for Tutor and document pipeline" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /><div><label className="label flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" /> Attached document under the video (optional)</label><input className="input mt-1" type="file" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />{attachment && <div className="text-xs text-slate-500 mt-2">{attachment.name}</div>}</div><div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Save"}</button></div></div></div>)}</>);
}
