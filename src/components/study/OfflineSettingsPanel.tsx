"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import {
  estimateOfflineBytes,
  listOffline,
  loadEncrypted,
  saveEncrypted,
  dropOffline,
} from "@/lib/study/offline-store";

/**
 * Compact Offline panel inside the Settings page. Replaces the giant
 * "Offline Mode — Storage — Quota — Unknown" card with:
 *   Downloaded Courses • N items  •  X MB
 *   [Download]   [Delete]
 *   Storage used: NN MB
 */
export default function OfflineSettingsPanel({ lessonIds }: { lessonIds: string[] }) {
  const [bytes, setBytes] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    void estimateOfflineBytes().then((n) => setBytes(n));
  }, []);

  async function refresh() {
    try {
      const items = await listOffline();
      setCount(items.length);
    } catch {
      setCount(0);
    }
  }

  async function downloadAll(passphrase: string) {
    if (!passphrase || passphrase.length < 4) {
      setError("Passphrase must be at least 4 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const id of lessonIds) {
        // We don't have the raw bytes here; the lesson page hands them in.
        // For settings-page UX we record the manifest, the real chunk
        // download happens from the lesson screen.
        const manifest = { lessonId: id, queuedAt: new Date().toISOString() };
        const encoded = new TextEncoder().encode(JSON.stringify(manifest));
        await saveEncrypted(`lesson:${id}`, encoded, passphrase);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not encrypt offline lessons.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: string) {
    await dropOffline(id);
    await refresh();
  }

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Offline</div>
          <div className="mt-1 text-sm text-slate-200">
            Downloaded Courses: {count} · {(bytes / (1024 * 1024)).toFixed(1)} MB
          </div>
        </div>
        <DownloadButton onClick={() => downloadAll(prompt("Set offline passphrase:") ?? "")} busy={busy} />
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</div> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <Loader2 className="hidden h-3 w-3 animate-spin" />
        <span>Storage used: {(bytes / (1024 * 1024)).toFixed(1)} MB</span>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => void removeOne("lesson:manifest")}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 transition hover:text-white"
          >
            <Trash2 className="h-3 w-3" /> Delete downloads
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DownloadButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Download
    </button>
  );
}
