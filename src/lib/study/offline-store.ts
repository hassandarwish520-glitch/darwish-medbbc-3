"use client";

import {
  decryptBytes,
  decryptJson,
  deriveKey,
  encryptBytes,
  encryptJson,
  newSaltB64,
  type EncryptedBlob,
} from "./crypto";

/**
 * offline-store.ts
 *
 * Minimal encrypted IndexedDB wrapper. Records are AES-256-GCM encrypted
 * before write. The DB name is namespaced per-app so two installations
 * do not collide.
 *
 * Honest limits (same as crypto.ts): this is obfuscation. A determined
 * attacker running code on the device can extract the key. The point is
 * to keep casual users (and file managers) from walking away with raw
 * PDF/HTML/MP4 files — exactly what was requested.
 */

const DB_NAME = "darwish-study-offline";
const STORE = "blobs";
const META = "meta";

type MetaRecord = { id: string; key: "salt"; value: string } | { id: string; key: "passphrase-check"; value: EncryptedBlob };

let cachedKey: CryptoKey | null = null;
let cachedSalt: string | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getMeta(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readonly");
    const store = tx.objectStore(META);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

async function setMeta(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const req = store.put({ id: key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function ensureOfflineKey(passphrase: string): Promise<CryptoKey> {
  if (cachedKey && cachedSalt) return cachedKey;
  const db = await openDb();
  let salt = (await getMeta(db, "salt")) as string | undefined;
  if (!salt) {
    salt = newSaltB64();
    await setMeta(db, "salt", salt);
  }
  cachedSalt = salt;
  cachedKey = await deriveKey(passphrase, salt);
  db.close();
  return cachedKey;
}

export async function saveEncrypted(id: string, data: Uint8Array, passphrase: string): Promise<void> {
  const key = await ensureOfflineKey(passphrase);
  const blob = await encryptBytes(key, data);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadEncrypted(id: string, passphrase: string): Promise<Uint8Array | null> {
  const key = await ensureOfflineKey(passphrase);
  const db = await openDb();
  const raw = await new Promise<EncryptedBlob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as EncryptedBlob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!raw) return null;
  return decryptBytes(key, raw);
}

export async function saveEncryptedJson<T>(id: string, value: T, passphrase: string): Promise<void> {
  const key = await ensureOfflineKey(passphrase);
  const blob = await encryptJson(key, value);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadEncryptedJson<T>(id: string, passphrase: string): Promise<T | null> {
  const key = await ensureOfflineKey(passphrase);
  const db = await openDb();
  const raw = await new Promise<EncryptedBlob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as EncryptedBlob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!raw) return null;
  return decryptJson<T>(key, raw);
}

export async function listOffline(): Promise<{ id: string; bytes: number }[]> {
  const db = await openDb();
  const out = await new Promise<{ id: string; bytes: number }[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const blobs = (req.result as EncryptedBlob[]) ?? [];
      resolve(
        blobs.map((b, idx) => ({
          id: String(idx),
          bytes: Math.floor((b.ciphertext.length * 3) / 4),
        })),
      );
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function dropOffline(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

export async function estimateOfflineBytes(): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
  const est = await navigator.storage.estimate();
  return est.usage ?? 0;
}
