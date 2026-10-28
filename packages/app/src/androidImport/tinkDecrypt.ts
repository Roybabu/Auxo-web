/**
 * Decrypts the optional passphrase lock the Android app can put on a backup
 * (`BackupCrypto.kt` there). This is a from-scratch, browser-side
 * reimplementation of Google Tink's `AesGcmHkdfStreaming` format using only
 * the standard Web Crypto API (PBKDF2, HKDF, AES-GCM) — there is no Tink
 * library for the browser, so this has to match the wire format exactly.
 *
 * File layout (see BackupCrypto.kt for the Kotlin side):
 *   [8 bytes "AUXOENC1"] [4 bytes iterations, big-endian] [16 bytes salt]   <- our own header (28 bytes)
 *   [Tink stream: 1 byte header length][32 bytes Tink salt][7 bytes nonce prefix]  <- Tink's own header (40 bytes)
 *   [segment_0][segment_1]...[segment_n-1]                                  <- AES-256-GCM, 1 segment = 1 MiB
 *
 * Verified against two independent, authoritative descriptions of Tink's
 * format (its Java source and Google's own published spec) rather than a
 * single source, since a mistake here fails loudly (the GCM tag just won't
 * verify) but silently producing the *wrong plaintext* is not a risk with
 * AEAD — any bug surfaces as a thrown error, not corrupted data.
 */

const MAGIC = new TextEncoder().encode("AUXOENC1"); // 8 bytes
const OUR_SALT_BYTES = 16;
const OUR_HEADER_BYTES = MAGIC.length + 4 + OUR_SALT_BYTES; // 28

const TINK_DERIVED_KEY_BYTES = 32; // AES-256
const TINK_NONCE_PREFIX_BYTES = 7;
const TINK_HEADER_BYTES = 1 + TINK_DERIVED_KEY_BYTES + TINK_NONCE_PREFIX_BYTES; // 40
const TINK_TAG_BYTES = 16;
const TINK_SEGMENT_BYTES = 1 << 20; // 1 MiB, matches BackupCrypto.SEGMENT_BYTES

export class EncryptedBackupError extends Error {}

/**
 * Newer @types/node's DOM lib widens Uint8Array's buffer type to
 * ArrayBufferLike (which includes SharedArrayBuffer), which no longer
 * satisfies Web Crypto's BufferSource — a type-checker-only mismatch,
 * never a runtime one here (none of these buffers are ever shared).
 */
function bs(u: Uint8Array): BufferSource {
  return u as BufferSource;
}

/** True when the file's first bytes are the "AUXOENC1" signature. */
export function looksPassphraseEncrypted(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

function concatBuffers(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Decrypts a passphrase-locked Android backup file, returning the plain
 * zip bytes inside it. Throws EncryptedBackupError on a malformed file or
 * a wrong passphrase (the AES-GCM tag fails to verify).
 */
export async function decryptPassphraseBackup(fileBytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (!looksPassphraseEncrypted(fileBytes)) {
    throw new EncryptedBackupError("This file isn't a passphrase-locked Auxo backup.");
  }
  if (fileBytes.length < OUR_HEADER_BYTES + TINK_HEADER_BYTES) {
    throw new EncryptedBackupError("This backup file is too short to be valid.");
  }

  const ourHeader = fileBytes.subarray(0, OUR_HEADER_BYTES);
  const headerView = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);
  const iterations = headerView.getUint32(MAGIC.length, false); // big-endian
  const ourSalt = fileBytes.subarray(MAGIC.length + 4, OUR_HEADER_BYTES);

  if (iterations < 1 || iterations > 5_000_000) {
    throw new EncryptedBackupError("This backup file looks corrupted.");
  }

  // 1. PBKDF2-HMAC-SHA256(passphrase, ourSalt, iterations) -> 32-byte IKM,
  //    exactly matching BackupCrypto.streaming()'s key derivation.
  const ikm = await pbkdf2(passphrase, ourSalt, iterations, TINK_DERIVED_KEY_BYTES);

  // 2. Tink's own header, written right after ours.
  const tinkHeader = fileBytes.subarray(OUR_HEADER_BYTES, OUR_HEADER_BYTES + TINK_HEADER_BYTES);
  if (tinkHeader[0] !== TINK_HEADER_BYTES) {
    throw new EncryptedBackupError("This backup file looks corrupted.");
  }
  const tinkSalt = tinkHeader.subarray(1, 1 + TINK_DERIVED_KEY_BYTES);
  const noncePrefix = tinkHeader.subarray(1 + TINK_DERIVED_KEY_BYTES);

  // 3. Per-stream key: HKDF-SHA256(ikm, salt=tinkSalt, info=ourHeader) -> 32 bytes.
  const streamKeyBytes = await hkdfSha256(ikm, tinkSalt, ourHeader, TINK_DERIVED_KEY_BYTES);
  const streamKey = await crypto.subtle.importKey("raw", bs(streamKeyBytes), "AES-GCM", false, ["decrypt"]);

  // 4. Segment the remaining ciphertext. The first segment is shorter by
  //    TINK_HEADER_BYTES (it shares a "block" with the header on disk).
  const ciphertextAfterHeaders = fileBytes.subarray(OUR_HEADER_BYTES + TINK_HEADER_BYTES);
  const firstChunkSize = TINK_SEGMENT_BYTES - TINK_HEADER_BYTES;

  const chunks: Uint8Array[] = [];
  let pos = 0;
  if (ciphertextAfterHeaders.length > 0) {
    chunks.push(ciphertextAfterHeaders.subarray(0, Math.min(firstChunkSize, ciphertextAfterHeaders.length)));
    pos = chunks[0]!.length;
    while (pos < ciphertextAfterHeaders.length) {
      const end = Math.min(pos + TINK_SEGMENT_BYTES, ciphertextAfterHeaders.length);
      chunks.push(ciphertextAfterHeaders.subarray(pos, end));
      pos = end;
    }
  } else {
    chunks.push(new Uint8Array(0)); // empty plaintext still has one (empty) segment + tag
  }

  const plaintextParts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const nonce = concatBuffers(noncePrefix, bigEndianUint32(i), new Uint8Array([isLast ? 1 : 0]));
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bs(nonce), tagLength: TINK_TAG_BYTES * 8 },
        streamKey,
        bs(chunks[i]!)
      );
      plaintextParts.push(new Uint8Array(plain));
    } catch {
      throw new EncryptedBackupError("Wrong passphrase, or this backup file is damaged.");
    }
  }

  return concatBuffers(...plaintextParts);
}

async function pbkdf2(passphrase: string, salt: Uint8Array, iterations: number, lengthBytes: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    bs(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bs(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

async function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", bs(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: bs(salt), info: bs(info) },
    key,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

function bigEndianUint32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, false);
  return out;
}
