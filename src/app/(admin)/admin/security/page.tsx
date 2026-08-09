import AdminSecurityCenter from "@/components/AdminSecurityCenter";
import Link from "next/link";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export default async function AdminSecurityPage() {
  const ctx = await requireAdmin();
  if (!ctx) return null;

  const admin = createAdminClient();
  const [eventsRes, devicesRes, profilesRes, filesRes] = await Promise.all([
    admin.from("security_events").select("id,user_id,event_type,device_key,device_type,metadata,created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("user_devices").select("id,user_id,device_type,label,platform,browser,last_seen_at,first_seen_at,last_ip,user_agent,is_active,meta").order("last_seen_at", { ascending: false }).limit(1000),
    admin.from("profiles").select("id,email,full_name,role,status"),
    admin.from("lessons").select("id,title,kind,storage_path,created_at,meta").order("created_at", { ascending: false }).limit(300),
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

  const files = (filesRes.data ?? [])
    .filter((lesson: any) => lesson?.storage_path || lesson?.kind === "html" || lesson?.kind === "html-inline" || lesson?.kind === "html-file" || lesson?.kind === "pdf" || lesson?.kind === "pptx")
    .map((lesson: any) => ({
      id: lesson.id,
      title: lesson.title || "Untitled file",
      kind: lesson.kind || "unknown",
      created_at: lesson.created_at || null,
      storage_path: lesson.storage_path || null,
      subject: typeof lesson?.meta?.subject === "string" ? lesson.meta.subject : null,
    }));

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Security & Device Center</h1>
          <p className="text-sm text-slate-400">راقب الأجهزة، سجل الفتح والتنزيل، وأخرج أي جهاز غير مرغوب به فورًا.</p>
        </div>
        <Link href="/admin" className="btn-ghost text-sm">Back to dashboard</Link>
      </div>

      <AdminSecurityCenter rows={rows} events={events} files={files} />
    </div>
  );
}
