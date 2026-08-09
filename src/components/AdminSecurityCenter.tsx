"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DeviceRow = {
  id: string;
  device_type: string | null;
  label: string | null;
  platform: string | null;
  browser: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  last_ip: string | null;
  user_agent: string | null;
  is_active: boolean;
  meta?: Record<string, unknown> | null;
};

type UserDeviceGroup = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  devices: DeviceRow[];
};

type SecurityEvent = {
  id: string;
  event_type: string;
  device_type: string | null;
  created_at: string | null;
  name: string;
  email: string;
  metadata?: Record<string, unknown> | null;
};

type FileRow = {
  id: string;
  title: string;
  kind: string;
  created_at: string | null;
  storage_path: string | null;
  subject: string | null;
};

const DEVICE_KEY_STORAGE = "medbbc:device-key";

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function badgeClass(active: boolean) {
  return active
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
    : "bg-rose-500/15 text-rose-300 border-rose-500/20";
}

export default function AdminSecurityCenter({
  rows,
  events,
  files,
}: {
  rows: UserDeviceGroup[];
  events: SecurityEvent[];
  files: FileRow[];
}) {
  const router = useRouter();
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [busyOthers, setBusyOthers] = useState(false);
  const [message, setMessage] = useState<string>("");

  const adminRow = useMemo(() => rows.find((row) => row.role === "admin" || row.email === "hassandarwish520@gmail.com") || null, [rows]);

  async function revokeDevice(deviceId: string) {
    setBusyDeviceId(deviceId);
    setMessage("");
    try {
      const response = await fetch(`/api/security/devices/${encodeURIComponent(deviceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "revoked from admin security center" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "تعذّر إلغاء الجهاز.");
      setMessage("تم إلغاء الجهاز المحدد وسيتم تسجيل خروجه تلقائيًا عند التحقق التالي.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذّر إلغاء الجهاز.");
    } finally {
      setBusyDeviceId(null);
    }
  }

  async function revokeOtherDevices() {
    const deviceKey = typeof window !== "undefined" ? window.localStorage.getItem(DEVICE_KEY_STORAGE) || "" : "";
    if (!deviceKey) {
      setMessage("تعذّر تحديد الجهاز الحالي. افتح الحساب من جهازك الحالي أولاً ثم أعد المحاولة.");
      return;
    }
    setBusyOthers(true);
    setMessage("");
    try {
      const response = await fetch("/api/security/devices/revoke-others", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_key: deviceKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "تعذّر إخراج بقية الأجهزة.");
      setMessage(`تم إخراج ${payload?.revoked ?? 0} جهاز آخر من الحساب الحالي.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذّر إخراج بقية الأجهزة.");
    } finally {
      setBusyOthers(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold">حماية فورية لحساب الإدارة</div>
          <div className="mt-1 text-amber-200/80">إذا شكّيت بوجود جهاز غريب على حساب الإدارة، استخدم زر إخراج بقية الأجهزة فورًا. الجهاز الملغى سيُفصل تلقائيًا عند أول تحقق أو تنقل داخل الموقع.</div>
        </div>
        <button
          type="button"
          onClick={revokeOtherDevices}
          disabled={busyOthers}
          className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyOthers ? "جارٍ إخراج بقية الأجهزة..." : "إخراج بقية أجهزة حسابي"}
        </button>
      </div>

      {adminRow ? (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-ink-800 px-4 py-3">
            <div className="text-sm font-semibold text-white">أجهزة حساب الإدارة</div>
            <div className="text-xs text-slate-400">راقب أي جهاز غير معروف، مع آخر IP وآخر توقيت نشاط.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-ink-800 text-left">
                  <th className="p-3">الجهاز</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">آخر ظهور</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {adminRow.devices.map((device) => (
                  <tr key={device.id} className="border-b border-ink-800 align-top">
                    <td className="p-3">
                      <div className="font-medium text-white">{device.label || "Unknown device"}</div>
                      <div className="mt-1 text-xs text-slate-500">{device.device_type || "—"} · {device.platform || "Unknown OS"} · {device.browser || "Unknown browser"}</div>
                      <div className="mt-1 break-all text-[11px] text-slate-600">{device.user_agent || ""}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${badgeClass(device.is_active)}`}>{device.is_active ? "نشط" : "ملغى"}</span>
                    </td>
                    <td className="p-3 text-xs text-slate-300">
                      <div>آخر نشاط: {fmtDateTime(device.last_seen_at)}</div>
                      <div className="mt-1 text-slate-500">أول تسجيل: {fmtDateTime(device.first_seen_at)}</div>
                    </td>
                    <td className="p-3 text-xs text-slate-300">{device.last_ip || "—"}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => revokeDevice(device.id)}
                        disabled={busyDeviceId === device.id || !device.is_active}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyDeviceId === device.id ? "جارٍ الإلغاء..." : device.is_active ? "إلغاء هذا الجهاز" : "مُلغى"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {message ? <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div> : null}

      <section className="card overflow-hidden p-0">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">كل الأجهزة المسجلة</div>
          <div className="text-xs text-slate-400">الحد الأقصى لكل حساب: 3 أجهزة. يمكنك إلغاء أي جهاز مشبوه مباشرة.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-ink-800 text-left">
                <th className="p-3">المستخدم</th>
                <th className="p-3">الدور</th>
                <th className="p-3">الأجهزة</th>
                <th className="p-3">آخر ظهور</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-ink-800 align-top">
                  <td className="p-3">
                    <div className="font-medium text-white">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.email}</div>
                    <div className="mt-1 text-[11px] text-slate-500">Status: {row.status}</div>
                  </td>
                  <td className="p-3">{row.role}</td>
                  <td className="p-3">
                    <div className="mb-2 text-xs text-slate-400">{row.devices.length}/3 أجهزة</div>
                    <div className="flex flex-col gap-2">
                      {row.devices.map((device) => (
                        <div key={device.id} className="rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="font-medium text-white">{device.label || `${device.platform || "Unknown"} · ${device.browser || "Browser"}`}</div>
                              <div className="mt-1 text-xs text-slate-500">{device.device_type} · {device.platform || "Unknown OS"} · {device.browser || "Unknown Browser"}</div>
                              <div className="mt-1 text-[11px] text-slate-600">IP: {device.last_ip || "—"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${badgeClass(device.is_active)}`}>{device.is_active ? "نشط" : "ملغى"}</span>
                              <button
                                type="button"
                                onClick={() => revokeDevice(device.id)}
                                disabled={busyDeviceId === device.id || !device.is_active}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busyDeviceId === device.id ? "جارٍ الإلغاء..." : device.is_active ? "إلغاء الجهاز" : "مُلغى"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">{fmtDateTime(row.devices[0]?.last_seen_at || null)}</td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">لا توجد أجهزة مسجلة بعد.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">سجل الأحداث الأمنية</div>
          <div className="text-xs text-slate-400">يفضح من دخل، ومن فتح، ومن حمّل، ومتى حصل ذلك بالضبط.</div>
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
                {event.metadata?.label ? <span className="text-slate-300">{String(event.metadata.label)}</span> : null}
                {event.metadata?.file_name ? <span className="text-amber-300">الملف: {String(event.metadata.file_name)}</span> : null}
                {event.metadata?.path ? <span className="text-slate-400">المسار: {String(event.metadata.path)}</span> : null}
                {event.metadata?.ip_address ? <span className="text-rose-300">IP: {String(event.metadata.ip_address)}</span> : null}
                {event.metadata?.source ? <span className="text-slate-500">المصدر: {String(event.metadata.source)}</span> : null}
              </div>
            </div>
          ))}
          {!events.length ? <div className="px-4 py-8 text-center text-sm text-slate-500">لا توجد أحداث أمنية مسجلة بعد.</div> : null}
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="border-b border-ink-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">فهرس الملفات المحمية</div>
          <div className="text-xs text-slate-400">قائمة بأحدث الملفات داخل النظام لتطابقها مع سجل الفتح والتنزيل.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-ink-800 text-left">
                <th className="p-3">العنوان</th>
                <th className="p-3">النوع</th>
                <th className="p-3">المادة</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">المسار</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-ink-800 align-top">
                  <td className="p-3 font-medium text-white">{file.title}</td>
                  <td className="p-3">{file.kind}</td>
                  <td className="p-3">{file.subject || "—"}</td>
                  <td className="p-3 text-xs text-slate-400">{fmtDateTime(file.created_at)}</td>
                  <td className="p-3 break-all text-xs text-slate-500">{file.storage_path || "inline/html"}</td>
                </tr>
              ))}
              {!files.length ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">لا توجد ملفات في الفهرس بعد.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
