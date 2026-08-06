"use client";

/**
 * crypto.ts
 *
 * Browser-side AES-256-GCM helpers used by the offline store.
 *
 * Honest disclaimer: AES-256 in the browser is obfuscation, not DRM.
 * A determined user can dump the key from memory. This module delivers
 * what is achievable on the web — it pushes the cost of extraction up
 * to "must run code on this device" — and is documented accordingly.
 *
 * Keys are derived from a user-bound passphrase (1Password-style derivation
 * using PBKDF2) so that simply copying the IndexedDB store to another
 * device is not enough to decrypt.
 */

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function newSaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
}

export type EncryptedBlob = { iv: string; ciphertext: string };

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(blob.iv) },
    key,
    base64ToBytes(blob.ciphertext),
  );
  return new Uint8Array(plaintext);
}

export async function encryptJson<T>(key: CryptoKey, value: T): Promise<EncryptedBlob> {
  const enc = new TextEncoder();
  return encryptBytes(key, enc.encode(JSON.stringify(value)));
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const bytes = await decryptBytes(key, blob);
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(bytes)) as T;
}
