"use client";
import { useState } from "react";
import { CheckCircle2, Ban, RotateCcw } from "lucide-react";

type Row = { id: string; email: string; full_name: string | null; institution: string | null; role: string; status: string; created_at: string; activated_at: string | null };

export default function StudentsTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "activate" | "suspend" | "reactivate") {
    setBusy(id);
    const r = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusy(null);
    if (r.ok) {
      const { row } = await r.json();
      setRows(rs => rs.map(x => x.id === id ? row : x));
    }
  }

  return (
    <div className="card mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-400">
          <tr className="text-left border-b border-ink-700">
            <th className="p-3">Name</th><th className="p-3">Email</th>
            <th className="p-3">Role</th><th className="p-3">Status</th>
            <th className="p-3">Joined</th><th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-ink-800">
              <td className="p-3">{r.full_name || "—"}<div className="text-xs text-slate-500">{r.institution || ""}</div></td>
              <td className="p-3">{r.email}</td>
              <td className="p-3 uppercase text-xs">{r.role}</td>
              <td className="p-3">
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  r.status === "active" ? "bg-emerald-500/20 text-emerald-300" :
                  r.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                  "bg-red-500/20 text-red-300"
                }`}>{r.status}</span>
              </td>
              <td className="p-3 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
              <td className="p-3 text-right space-x-2">
                {r.status === "pending" && (
                  <button className="btn-primary text-xs" disabled={busy===r.id} onClick={()=>act(r.id,"activate")}>
                    <CheckCircle2 className="h-3 w-3"/> Activate
                  </button>
                )}
                {r.status === "active" && r.role !== "admin" && (
                  <button className="btn-ghost text-xs" disabled={busy===r.id} onClick={()=>act(r.id,"suspend")}>
                    <Ban className="h-3 w-3"/> Suspend
                  </button>
                )}
                {r.status === "suspended" && (
                  <button className="btn-ghost text-xs" disabled={busy===r.id} onClick={()=>act(r.id,"reactivate")}>
                    <RotateCcw className="h-3 w-3"/> Reactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No students yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
