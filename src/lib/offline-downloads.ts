export type OfflinePackageAsset = {
  id: string;
  url: string;
  label: string;
  kind: string;
  mime?: string | null;
  cacheable: boolean;
};

export type OfflinePackage = {
  lessonId: string;
  lessonTitle: string;
  provider?: string | null;
  addedAt: string;
  updatedAt: string;
  assets: OfflinePackageAsset[];
  cachedAssetIds: string[];
  notesCount: number;
  progress: {
    position: number;
    duration: number;
    watchedSeconds: number;
    completed: boolean;
  };
  status: "ready" | "partial" | "queued";
  warnings: string[];
};

const STORAGE_KEY = "medbbc-offline-packages:v1";
const CACHE_NAME = "medbbc-offline-cache:v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeUrl(url: string) {
  return url.trim();
}

function readPackages(): OfflinePackage[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflinePackage[]) : [];
  } catch {
    return [];
  }
}

function writePackages(packages: OfflinePackage[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
}

function dedupeAssets(assets: OfflinePackageAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.id}|${asset.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function cacheAssets(assets: OfflinePackageAsset[]) {
  const cachedAssetIds: string[] = [];
  const failedAssetIds: string[] = [];

  if (!isBrowser() || !("caches" in window)) {
    return { cachedAssetIds, failedAssetIds: assets.filter((asset) => asset.cacheable).map((asset) => asset.id) };
  }

  const cache = await caches.open(CACHE_NAME);

  for (const asset of assets) {
    if (!asset.cacheable) continue;
    try {
      await cache.add(normalizeUrl(asset.url));
      cachedAssetIds.push(asset.id);
    } catch {
      failedAssetIds.push(asset.id);
    }
  }

  return { cachedAssetIds, failedAssetIds };
}

export function listOfflinePackages() {
  return readPackages().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getOfflinePackage(lessonId: string) {
  return readPackages().find((item) => item.lessonId === lessonId) ?? null;
}

export async function upsertOfflinePackage(input: {
  lessonId: string;
  lessonTitle: string;
  provider?: string | null;
  assets: OfflinePackageAsset[];
  notesCount: number;
  progress: OfflinePackage["progress"];
  warnings?: string[];
}) {
  const packages = readPackages();
  const now = new Date().toISOString();
  const existing = packages.find((item) => item.lessonId === input.lessonId) ?? null;
  const assets = dedupeAssets(input.assets);
  const { cachedAssetIds } = await cacheAssets(assets);
  const cacheableCount = assets.filter((asset) => asset.cacheable).length;
  const status: OfflinePackage["status"] = cacheableCount === 0 ? "queued" : cachedAssetIds.length === cacheableCount ? "ready" : cachedAssetIds.length > 0 ? "partial" : "queued";

  const next: OfflinePackage = {
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    provider: input.provider ?? null,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
    assets,
    cachedAssetIds,
    notesCount: input.notesCount,
    progress: input.progress,
    status,
    warnings: input.warnings?.filter(Boolean) ?? [],
  };

  const filtered = packages.filter((item) => item.lessonId !== input.lessonId);
  filtered.unshift(next);
  writePackages(filtered);
  return next;
}

export async function removeOfflinePackage(lessonId: string) {
  const packages = readPackages();
  const existing = packages.find((item) => item.lessonId === lessonId) ?? null;
  if (existing && isBrowser() && "caches" in window) {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(existing.assets.filter((asset) => asset.cacheable).map((asset) => cache.delete(normalizeUrl(asset.url))));
  }
  writePackages(packages.filter((item) => item.lessonId !== lessonId));
}
