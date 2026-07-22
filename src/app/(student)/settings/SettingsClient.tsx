"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsClient({ profile }: { profile: any }) {
  const [form, setForm] = useState({ full_name: profile?.full_name ?? "", institution: profile?.institution ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k:string,v:string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    const s = createClient();
    const { error } = await s.from("profiles").update(form).eq("id", profile.id);
    setMsg(error ? error.message : "Saved ✓");
  }

  return (
    <div className="card p-5 mt-4 space-y-3">
      <div><label className="label">Email</label><input className="input mt-1" value={profile.email} disabled/></div>
      <div><label className="label">Role</label><input className="input mt-1" value={profile.role} disabled/></div>
      <div><label className="label">Full name</label>
        <input className="input mt-1" value={form.full_name} onChange={e=>set("full_name", e.target.value)}/></div>
      <div><label className="label">Institution</label>
        <input className="input mt-1" value={form.institution} onChange={e=>set("institution", e.target.value)}/></div>
      <button className="btn-primary" onClick={save}>Save</button>
      {msg && <p className="text-sm text-brand">{msg}</p>}
    </div>
  );
}
