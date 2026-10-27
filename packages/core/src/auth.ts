/**
 * Password hashing.
 *
 * Uses the standard Web Crypto API (crypto.subtle), which is available
 * as a global in browsers, Node 20+, and Tauri's webview — not a
 * browser-only DOM API — so this stays valid "no browser code" per the
 * core package's rules. PBKDF2 with a per-password random salt and a
 * meaningful iteration count, not a bare SHA-256 hash.
 */

interface WebCryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: {
    importKey(
      format: "raw",
      keyData: Uint8Array,
      algorithm: string,
      extractable: boolean,
      keyUsages: string[]
    ): Promise<unknown>;
    deriveBits(algorithm: unknown, baseKey: unknown, length: number): Promise<ArrayBuffer>;
  };
}

function getCrypto(): WebCryptoLike {
  const c = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (!c?.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) is not available in this environment");
  }
  return c;
}

const PBKDF2_ITERATIONS = 150_000;
const HASH_BYTE_LENGTH = 32;
const SALT_BYTE_LENGTH = 16;

export interface PasswordHash {
  algorithm: "pbkdf2-sha256";
  iterations: number;
  saltHex: string;
  hashHex: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function deriveBits(password: string, saltBytes: Uint8Array, iterations: number): Promise<Uint8Array> {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BYTE_LENGTH * 8
  );
  return new Uint8Array(derived);
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const crypto = getCrypto();
  const saltBytes = new Uint8Array(SALT_BYTE_LENGTH);
  crypto.getRandomValues(saltBytes);
  const hashBytes = await deriveBits(password, saltBytes, PBKDF2_ITERATIONS);
  return {
    algorithm: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    saltHex: bytesToHex(saltBytes),
    hashHex: bytesToHex(hashBytes),
  };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const saltBytes = hexToBytes(stored.saltHex);
  const hashBytes = await deriveBits(password, saltBytes, stored.iterations);
  const candidateHex = bytesToHex(hashBytes);
  return constantTimeEqual(candidateHex, stored.hashHex);
}

/** Avoids leaking timing information about where two strings first differ. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
