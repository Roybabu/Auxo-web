import { describe, expect, it } from "vitest";
import { decryptPassphraseBackup, looksPassphraseEncrypted, EncryptedBackupError } from "./tinkDecrypt.js";

/**
 * A from-the-same-spec encryptor, used only to build test fixtures. This is
 * NOT a copy of tinkDecrypt.ts's logic reused backwards — it's written
 * independently against the spec (header layout, HKDF/AES-GCM parameters,
 * segmenting) so that a round-trip passing here means both sides agree with
 * the spec, not just with each other by construction.
 *
 * This checks internal self-consistency with the documented Tink wire
 * format; it is not a substitute for testing against a real file produced
 * by the Android app's own Kotlin/Tink code, which is the real test.
 */
const MAGIC = new TextEncoder().encode("AUXOENC1");
const OUR_SALT_BYTES = 16;
const TINK_KEY_BYTES = 32;
const TINK_NONCE_PREFIX_BYTES = 7;
const TINK_HEADER_BYTES = 1 + TINK_KEY_BYTES + TINK_NONCE_PREFIX_BYTES;
const TINK_SEGMENT_BYTES = 1 << 20;

/** Same type-checker-only BufferSource widening workaround as tinkDecrypt.ts. */
function bs(u: Uint8Array): BufferSource {
  return u as BufferSource;
}

async function pbkdf2(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", bs(new TextEncoder().encode(passphrase)), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bs(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", bs(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: bs(salt), info: bs(info) }, key, 256);
  return new Uint8Array(bits);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function be32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, false);
  return out;
}

async function encryptFixture(plaintext: Uint8Array, passphrase: string, iterations = 1000): Promise<Uint8Array> {
  const ourSalt = crypto.getRandomValues(new Uint8Array(OUR_SALT_BYTES));
  const ourHeader = concat(MAGIC, be32(iterations), ourSalt);

  const ikm = await pbkdf2(passphrase, ourSalt, iterations);

  const tinkSalt = crypto.getRandomValues(new Uint8Array(TINK_KEY_BYTES));
  const noncePrefix = crypto.getRandomValues(new Uint8Array(TINK_NONCE_PREFIX_BYTES));
  const tinkHeader = concat(new Uint8Array([TINK_HEADER_BYTES]), tinkSalt, noncePrefix);

  const streamKeyBytes = await hkdf(ikm, tinkSalt, ourHeader);
  const streamKey = await crypto.subtle.importKey("raw", bs(streamKeyBytes), "AES-GCM", false, ["encrypt"]);

  // Plaintext max for segment 0: the on-disk ciphertext budget for that
  // segment (SEGMENT_BYTES - HEADER_BYTES) minus the 16-byte GCM tag.
  const firstChunkMax = TINK_SEGMENT_BYTES - TINK_HEADER_BYTES - 16;
  const chunks: Uint8Array[] = [];
  if (plaintext.length === 0) {
    chunks.push(new Uint8Array(0));
  } else {
    let pos = 0;
    chunks.push(plaintext.subarray(0, Math.min(firstChunkMax, plaintext.length)));
    pos = chunks[0]!.length;
    while (pos < plaintext.length) {
      const end = Math.min(pos + TINK_SEGMENT_BYTES - 16, plaintext.length);
      chunks.push(plaintext.subarray(pos, end));
      pos = end;
    }
  }

  const ciphertextParts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const nonce = concat(noncePrefix, be32(i), new Uint8Array([isLast ? 1 : 0]));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce), tagLength: 128 }, streamKey, bs(chunks[i]!));
    ciphertextParts.push(new Uint8Array(ct));
  }

  return concat(ourHeader, tinkHeader, ...ciphertextParts);
}

describe("looksPassphraseEncrypted", () => {
  it("recognizes the AUXOENC1 magic", () => {
    expect(looksPassphraseEncrypted(new TextEncoder().encode("AUXOENC1rest"))).toBe(true);
  });

  it("rejects anything else, including a plain zip (PK header)", () => {
    expect(looksPassphraseEncrypted(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
    expect(looksPassphraseEncrypted(new Uint8Array(0))).toBe(false);
  });
});

describe("decryptPassphraseBackup (round-trip against an independent from-spec encryptor)", () => {
  it("round-trips a small plaintext", async () => {
    const plaintext = new TextEncoder().encode("Hello, this is a fake Auxo zip payload!");
    const encrypted = await encryptFixture(plaintext, "correct horse battery staple");
    const decrypted = await decryptPassphraseBackup(encrypted, "correct horse battery staple");
    expect(new TextDecoder().decode(decrypted)).toBe(new TextDecoder().decode(plaintext));
  });

  it("round-trips an empty plaintext", async () => {
    const encrypted = await encryptFixture(new Uint8Array(0), "another pass");
    const decrypted = await decryptPassphraseBackup(encrypted, "another pass");
    expect(decrypted.length).toBe(0);
  });

  it("round-trips a plaintext spanning exactly two segments (boundary test)", async () => {
    // First segment max = SEGMENT_BYTES - HEADER_BYTES(40) = 1,048,536.
    // Use 1,048,537 bytes so a 1-byte second segment is forced.
    const size = (1 << 20) - 40 + 1;
    const plaintext = new Uint8Array(size);
    for (let i = 0; i < size; i++) plaintext[i] = i % 251;
    const encrypted = await encryptFixture(plaintext, "segment boundary test pass");
    const decrypted = await decryptPassphraseBackup(encrypted, "segment boundary test pass");
    expect(decrypted.length).toBe(size);
    expect(decrypted).toEqual(plaintext);
  }, 30_000);

  it("rejects the wrong passphrase", async () => {
    const encrypted = await encryptFixture(new TextEncoder().encode("secret data"), "right passphrase");
    await expect(decryptPassphraseBackup(encrypted, "wrong passphrase")).rejects.toThrow(EncryptedBackupError);
  });

  it("rejects a file that doesn't start with the AUXOENC1 signature", async () => {
    await expect(decryptPassphraseBackup(new TextEncoder().encode("not a backup"), "anything")).rejects.toThrow(
      EncryptedBackupError
    );
  });
});
