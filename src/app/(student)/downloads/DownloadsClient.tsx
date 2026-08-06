"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, HardDriveDownload, Lock, RefreshCw, Trash2 } from "lucide-react";
import { listOfflinePackages, removeOfflinePackage, type OfflinePackage } from "@/lib/offline-downloads";

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getProgressLabel(item: OfflinePackage) {
  if (item.progress.completed) return "Done";
  if (item.progress.duration > 0) {
    return `${Math.round((item.progress.position / Math.max(item.progress.duration, 1)) * 100)}%`;
  }
  return "—";
}

function statusBadge(status: OfflinePackage["status"]) {
  if (status === "ready") return { text: "Cached in app", cls: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" };
  if (status === "partial") return { text: "Partially cached", cls: "border-amber-400/20 bg-amber-500/10 text-amber-300" };
  return { text: "Saved for in-app access", cls: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300" };
}

export default function DownloadsClient() {
  const [items, setItems] = useState<OfflinePackage[]>([]);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);

  function refresh() {
    setItems(listOfflinePackages());
  }

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function removeItem(lessonId: string) {
    setBusyLessonId(lessonId);
    try {
      await removeOfflinePackage(lessonId);
      refresh();
    } finally {
      setBusyLessonId(null);
    }
  }

  return (
    <div className="page-shell max-w-5xl pb-10">
      <section className="card mt-4 overflow-hidden border-ink-800 bg-ink-900">
        <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-500 via-brand to-cyan-400" />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <HardDriveDownload className="h-3.5 w-3.5" /> Downloads
              </div>
              <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Offline packages inside the app</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Lectures added from the study page are managed here. The goal is to keep access inside the application flow without pushing the student to an external browser.
              </p>
            </div>
            <button type="button" className="subject-tab" onClick={refresh}>
              <RefreshCw className="h-4 w-4" /> <span>Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {!items.length ? (
        <section className="card mt-6 border-ink-800 bg-ink-900/70 p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.03] text-slate-400">
            <Download className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-white">No offline packages yet</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Open any lesson and use “Add to Downloads” from the offline section to keep that lecture package available inside the app.
          </p>
          <div className="mt-5">
            <Link href="/videos" className="btn-primary">Go to videos</Link>
          </div>
        </section>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const badge = statusBadge(item.status);
            return (
              <section key={item.lessonId} className="rounded-[28px] border border-ink-800 bg-ink-900/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
                      {item.provider ? <span className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{item.provider}</span> : null}
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-white">{item.lessonTitle}</h2>
                    <p className="mt-2 text-xs leading-6 text-slate-500">Updated {formatDate(item.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/lesson/${item.lessonId}`} className="subject-tab">
                      <Download className="h-4 w-4" /> <span>Open lesson</span>
                    </Link>
                    <button type="button" className="subject-tab" onClick={() => void removeItem(item.lessonId)} disabled={busyLessonId === item.lessonId}>
                      <Trash2 className="h-4 w-4" /> <span>{busyLessonId === item.lessonId ? "Removing…" : "Remove"}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Items</div>
                    <div className="mt-2 text-lg font-bold text-white">{item.assets.length}</div>
                  </div>
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cached</div>
                    <div className="mt-2 text-lg font-bold text-white">{item.cachedAssetIds.length}</div>
                  </div>
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Notes</div>
                    <div className="mt-2 text-lg font-bold text-white">{item.notesCount}</div>
                  </div>
                  <div className="rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Progress</div>
                    <div className="mt-2 text-lg font-bold text-white">{getProgressLabel(item)}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-ink-800 bg-[#07111d] px-4 py-3 text-sm leading-7 text-slate-400">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-200">
                    <Lock className="h-4 w-4 text-fuchsia-300" /> In-app workflow only
                  </span>
                  <div className="mt-2">
                    Lecture Materials stay on the lesson page. This downloads page is only for managing the saved package and cached access inside the app flow.
                  </div>
                  {item.warnings.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-300">
                      {item.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
