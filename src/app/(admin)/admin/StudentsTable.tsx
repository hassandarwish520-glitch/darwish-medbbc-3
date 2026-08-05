"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Ban, RotateCcw, MailCheck, ShieldCheck, UserRoundCheck, Clock3 } from "lucide-react";

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  role: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  email_confirmed_at?: string | null;
};

type FilterKey = "all" | "pending" | "unconfirmed" | "active" | "suspended";
type ActionKey = "activate" | "suspend" | "reactivate" | "confirm_email" | "approve_access";

const ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "educator", label: "Instructor" },
  { value: "admin", label: "Admin" },
] as const;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Registration Requests" },
  { key: "unconfirmed", label: "Unconfirmed Email" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

function isConfirmed(row: Row) {
  return Boolean(row.email_confirmed_at);
}

function hasLiveAccess(row: Row) {
  return row.status === "active" && isConfirmed(row);
}

function sortRows(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const aPending = a.status === "pending" ? 1 : 0;
    const bPending = b.status === "pending" ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;

    const aUnconfirmed = !isConfirmed(a) ? 1 : 0;
    const bUnconfirmed = !isConfirmed(b) ? 1 : 0;
    if (aUnconfirmed !== bUnconfirmed) return bUnconfirmed - aUnconfirmed;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function StudentsTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(sortRows(initial));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");

  async function act(id: string, action: ActionKey) {
    setBusy(`${id}:${action}`);
    setError(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusy(null);
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      setError(payload?.error || "Action failed");
      return;
    }
    const { row } = await r.json();
    setRows((rs) => sortRows(rs.map((x) => (x.id === id ? { ...x, ...row } : x))));
  }

  async function setRole(id: string, role: string) {
    setBusy(`${id}:role`);
    setError(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "set_role", role }),
    });
    setBusy(null);
    if (!r.ok) {
      const payload = await r.json().catch(() => ({}));
      setError(payload?.error || "Role update failed");
      return;
    }
    const { row } = await r.json();
    setRows((rs) => sortRows(rs.map((x) => (x.id === id ? { ...x, ...row } : x))));
  }

  const summary = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    unconfirmed: rows.filter((row) => !isConfirmed(row)).length,
    active: rows.filter((row) => hasLiveAccess(row)).length,
    suspended: rows.filter((row) => row.status === "suspended").length,
  }), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filter === "pending") return row.status === "pending";
    if (filter === "unconfirmed") return !isConfirmed(row);
    if (filter === "active") return hasLiveAccess(row);
    if (filter === "suspended") return row.status === "suspended";
    return true;
  }), [rows, filter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><Clock3 className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending requests</div>
              <div className="text-2xl font-semibold text-white">{summary.pending}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300"><MailCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Unconfirmed email</div>
              <div className="text-2xl font-semibold text-white">{summary.unconfirmed}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300"><UserRoundCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Live access</div>
              <div className="text-2xl font-semibold text-white">{summary.active}</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-300"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Total accounts</div>
              <div className="text-2xl font-semibold text-white">{summary.total}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto p-0">
        <div className="border-b border-ink-800 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Registration approvals inside the app</div>
              <div className="text-xs text-slate-400">Activate Access now confirms email if needed and grants access immediately. Suspend blocks access immediately.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200" : "border-ink-700 bg-ink-900 text-slate-400 hover:text-slate-200"}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error ? <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div> : null}
        </div>

        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr className="border-b border-ink-700 text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const roleBusy = busy === `${r.id}:role`;
              const statusBusy = busy?.startsWith(`${r.id}:`) && !roleBusy;
              const confirmed = isConfirmed(r);
              const liveAccess = hasLiveAccess(r);
              const needsApproval = !liveAccess;
              return (
                <tr key={r.id} className="border-b border-ink-800 align-top">
                  <td className="p-3">
                    <div className="font-medium text-white">{r.full_name || "—"}</div>
                    <div className="text-xs text-slate-500">{r.institution || ""}</div>
                    {r.status === "pending" ? (
                      <div className="mt-2 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">New registration request</div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <div>{r.email}</div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] ${confirmed ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {confirmed ? "Email confirmed" : "Email not confirmed"}
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      className="input h-10 min-w-[140px]"
                      value={r.role}
                      disabled={roleBusy || r.role === "admin"}
                      onChange={(e) => setRole(r.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${
                        r.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "pending"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-red-500/20 text-red-300"
                      }`}>{r.status}</span>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] ${
                        liveAccess ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-700/50 text-slate-300"
                      }`}>{liveAccess ? "Access live" : "No live access"}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {needsApproval ? (
                        <button className="btn-primary text-xs" disabled={Boolean(statusBusy)} onClick={() => act(r.id, "approve_access")}>
                          <CheckCircle2 className="h-3 w-3" /> Verify + Activate
                        </button>
                      ) : null}
                      {!confirmed ? (
                        <button className="btn-ghost text-xs" disabled={Boolean(statusBusy)} onClick={() => act(r.id, "confirm_email")}>
                          <MailCheck className="h-3 w-3" /> Verify Email Only
                        </button>
                      ) : null}
                      {r.status === "pending" ? (
                        <button className="btn-ghost text-xs" disabled={Boolean(statusBusy)} onClick={() => act(r.id, "activate")}>
                          <ShieldCheck className="h-3 w-3" /> Activate Access
                        </button>
                      ) : null}
                      {r.status === "active" && r.role !== "admin" ? (
                        <button className="btn-ghost text-xs" disabled={Boolean(statusBusy)} onClick={() => act(r.id, "suspend")}>
                          <Ban className="h-3 w-3" /> Suspend
                        </button>
                      ) : null}
                      {r.status === "suspended" ? (
                        <button className="btn-ghost text-xs" disabled={Boolean(statusBusy)} onClick={() => act(r.id, "reactivate")}>
                          <RotateCcw className="h-3 w-3" /> Reactivate Access
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredRows.length ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No matching accounts.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
