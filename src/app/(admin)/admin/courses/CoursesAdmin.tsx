"use client";
import { useState } from "react";
import { slugify } from "@/lib/utils";
import { Plus, Eye, EyeOff, Trash2 } from "lucide-react";

type Course = { id: string; title: string; slug: string; description: string | null; visible: boolean };

export default function CoursesAdmin({ initial }: { initial: Course[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  async function create() {
    const r = await fetch("/api/admin/courses", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, slug: slugify(form.title) }) });
    if (r.ok) { const { course } = await r.json(); setRows(rs=>[course,...rs]); setOpen(false); setForm({ title:"", description:"" }); }
  }
  async function toggle(c: Course) {
    const r = await fetch("/api/admin/courses", { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id: c.id, visible: !c.visible }) });
    if (r.ok) setRows(rs => rs.map(x => x.id===c.id ? { ...x, visible: !c.visible } : x));
  }
  async function remove(c: Course) {
    if (!confirm(`Delete "${c.title}"?`)) return;
    await fetch("/api/admin/courses?id="+c.id, { method:"DELETE" });
    setRows(rs => rs.filter(x => x.id !== c.id));
  }

  return (
    <>
      <button className="btn-primary mt-4" onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/> New course</button>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {rows.map(c => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-slate-500">/{c.slug}</div>
              </div>
              <div className="flex gap-1">
                <button className="btn-ghost text-xs" onClick={()=>toggle(c)}>
                  {c.visible ? <Eye className="h-3 w-3"/> : <EyeOff className="h-3 w-3"/>}
                </button>
                <button className="btn-ghost text-xs" onClick={()=>remove(c)}><Trash2 className="h-3 w-3"/></button>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2 line-clamp-2">{c.description}</p>
          </div>
        ))}
        {!rows.length && <div className="text-slate-500 text-sm">No courses yet.</div>}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
          <div className="card p-5 w-full max-w-md">
            <h3 className="text-lg font-semibold">New course</h3>
            <div className="mt-3 space-y-3">
              <input className="input" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
              <textarea className="input h-24" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={create}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
