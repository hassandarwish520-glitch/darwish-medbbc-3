import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default async function AdminSecurityPage() {
  const admin = createAdminClient();
  const [eventsRes, devicesRes, profilesRes] = await Promise.all([
    admin.from("security_events").select("id,user_id,event_type,device_key,device_type,metadata,created_at").order("created_at", { ascending: false }).limit(300),
    admin.from("user_devices").select("id,user_id,device_type,label,platform,browser,last_seen_at,is_active").order("last_seen_at", { ascending: false }).limit(1000),
    admin.from("profiles").select("id,email,full_name,role,status"),
  ]);

  const profiles = new Map((profilesRes.data ?? []).map((row: any) => [row.id, row]));
  const devices = devicesRes.data ?? [];
  const grouped = new Map<string, any[]>();
  for (const device of devices) {
    const list = grouped.get(device.user_id) ?? [];
    list.push(device);
    grouped.set(device.user_id, list);
  }

  const rows = Array.from(grouped.entries())
    .map(([userId, userDevices]) => {
      const profile = profiles.get(userId);
      return {
        userId,
        name: profile?.full_name || profile?.email || userId,
        email: profile?.email || "—",
        role: profile?.role || "student",
        status: profile?.status || "—",
        devices: userDevices,
      };
    })
    .sort((a, b) => {
      const aLast = a.devices[0]?.last_seen_at || "";
      const bLast = b.devices[0]?.last_seen_at || "";
      return bLast.localeCompare(aLast);
    });

  const events = (eventsRes.data ?? []).map((event: any) => {
    const profile = profiles.get(event.user_id);
    return {
      ...event,
      name: profile?.full_name || profile?.email || event.user_id,
      email: profile?.email || "—",
    };
  });

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Security & Device Center</h1>
          <p className="text-sm text-slate-400">Track logged-in devices, admin-account alerts, and download history in one place.</p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">Back to dashboard</Link>
      </div>

      <section className="card overflow-hidden p-0">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">Registered devices by user</div>
          <div className="text-xs text-slate-400">Maximum allowed devices per account: 3.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-ink-800 text-left">
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Devices</th>
                <th className="p-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-ink-800 align-top">
                  <td className="p-3">
                    <div className="font-medium text-white">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.email}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Status: {row.status}</div>
                  </td>
                  <td className="p-3">{row.role}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-slate-400">{row.devices.length}/3 devices</div>
                      {row.devices.map((device: any) => (
                        <div key={device.id} className="rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2">
                          <div className="font-medium text-white">{device.label || `${device.platform || "Unknown"} · ${device.browser || "Browser"}`}</div>
                          <div className="mt-1 text-xs text-slate-500">{device.device_type} · {device.platform || "Unknown OS"} · {device.browser || "Unknown Browser"}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">{fmtDateTime(row.devices[0]?.last_seen_at || null)}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">No registered devices yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">Security event history</div>
          <div className="text-xs text-slate-400">Includes new-device admin logins, blocked extra devices, and admin-side downloads.</div>
        </div>
        <div className="divide-y divide-ink-800">
          {events.map((event) => (
            <div key={event.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{event.name}</div>
                  <div className="text-xs text-slate-500">{event.email}</div>
                </div>
                <div className="text-right text-xs text-slate-400">{fmtDateTime(event.created_at)}</div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-ink-800 px-2 py-1 text-slate-300">{event.event_type}</span>
                {event.device_type ? <span className="rounded-full bg-ink-800 px-2 py-1 text-slate-300">{event.device_type}</span> : null}
                {event.metadata?.label ? <span className="text-slate-400">{String(event.metadata.label)}</span> : null}
                {event.metadata?.file_name ? <span className="text-amber-300">{String(event.metadata.file_name)}</span> : null}
                {event.metadata?.path ? <span className="text-slate-500">{String(event.metadata.path)}</span> : null}
              </div>
            </div>
          ))}
          {!events.length ? <div className="px-4 py-8 text-center text-sm text-slate-500">No security events logged yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
