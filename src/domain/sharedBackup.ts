// Shared AUXO backup container, format "auxo-backup" version 1 (see docs/BACKUP_FORMAT.md).
// Only the encrypted container lives here. The JSON payload mapping is implemented separately.

export const SHARED_BACKUP_MAGIC = 'AUXOBKUP';
export const SHARED_BACKUP_VERSION = 1;
export const SHARED_BACKUP_ITERATIONS = 600_000;
export const SHARED_BACKUP_HEADER_BYTES = 74;
export const SHARED_BACKUP_MIN_BYTES = 90;
export const SHARED_BACKUP_MAX_PLAINTEXT_BYTES = 256 * 1024 * 1024;

const KDF_NAME = 'PBKDF2-HMAC-SHA256';
const CIPHER_NAME = 'AES-256-GCM';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

type Options = { salt?: Uint8Array; nonce?: Uint8Array; iterations?: number };

function writeAscii(target: Uint8Array, offset: number, width: number, text: string) {
  for (let i = 0; i < width; i++) target[offset + i] = i < text.length ? text.charCodeAt(i) : 0;
}

function readAscii(source: Uint8Array, offset: number, width: number): string {
  let end = offset;
  while (end < offset + width && source[end] !== 0) end++;
  return String.fromCharCode(...source.subarray(offset, end));
}

/** Builds the 74-byte header. The same bytes are used as authenticated data. */
export function buildSharedBackupHeader(salt: Uint8Array, nonce: Uint8Array, iterations = SHARED_BACKUP_ITERATIONS): Uint8Array {
  if (salt.length !== 16 || nonce.length !== 12) throw new Error('Backup salt or nonce has the wrong length.');
  const header = new Uint8Array(SHARED_BACKUP_HEADER_BYTES);
  writeAscii(header, 0, 8, SHARED_BACKUP_MAGIC);
  new DataView(header.buffer).setUint16(8, SHARED_BACKUP_VERSION, false);
  writeAscii(header, 10, 20, KDF_NAME);
  writeAscii(header, 30, 12, CIPHER_NAME);
  new DataView(header.buffer).setUint32(42, iterations, false);
  header.set(salt, 46);
  header.set(nonce, 62);
  return header;
}

/** Parses and checks the header. Throws before any key derivation if anything is unexpected. */
export function parseSharedBackupHeader(bytes: Uint8Array) {
  if (bytes.length < SHARED_BACKUP_MIN_BYTES) throw new Error('This file is too small to be an AUXO backup.');
  if (readAscii(bytes, 0, 8) !== SHARED_BACKUP_MAGIC) throw new Error('This is not an AUXO backup file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, false) !== SHARED_BACKUP_VERSION) throw new Error('This backup needs a newer version of AUXO.');
  if (readAscii(bytes, 10, 20) !== KDF_NAME || readAscii(bytes, 30, 12) !== CIPHER_NAME) {
    throw new Error('This backup uses an unsupported encryption method.');
  }
  const iterations = view.getUint32(42, false);
  if (iterations !== SHARED_BACKUP_ITERATIONS) throw new Error('This backup uses unsupported key settings.');
  return {
    iterations,
    salt: bytes.slice(46, 62),
    nonce: bytes.slice(62, 74),
    header: bytes.slice(0, SHARED_BACKUP_HEADER_BYTES),
  };
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]): Promise<CryptoKey> {
  const normalized = passphrase.normalize('NFC');
  const base = await crypto.subtle.importKey('raw', encoder.encode(normalized), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    256,
  );
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, usage);
}

/** Encrypts UTF-8 JSON text into a complete backup file. */
export async function encryptSharedBackup(json: string, passphrase: string, options: Options = {}): Promise<Uint8Array> {
  if (!passphrase) throw new Error('Enter a backup passphrase.');
  const plaintext = encoder.encode(json);
  if (plaintext.byteLength > SHARED_BACKUP_MAX_PLAINTEXT_BYTES) {
    throw new Error('This backup is too large to save. Remove old photos or split the data.');
  }
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const nonce = options.nonce ?? crypto.getRandomValues(new Uint8Array(12));
  const header = buildSharedBackupHeader(salt, nonce, options.iterations ?? SHARED_BACKUP_ITERATIONS);
  const key = await deriveKey(passphrase, salt, options.iterations ?? SHARED_BACKUP_ITERATIONS, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: header as BufferSource, tagLength: 128 },
    key,
    plaintext as BufferSource,
  ));
  const file = new Uint8Array(header.length + sealed.length);
  file.set(header, 0);
  file.set(sealed, header.length);
  return file;
}

/** Authenticates and decrypts a backup file, returning the UTF-8 JSON text. Nothing is returned unless the tag checks out. */
export async function decryptSharedBackup(file: Uint8Array, passphrase: string): Promise<string> {
  const parsed = parseSharedBackupHeader(file);
  if (file.length - SHARED_BACKUP_HEADER_BYTES - 16 > SHARED_BACKUP_MAX_PLAINTEXT_BYTES) {
    throw new Error('This backup is too large to open.');
  }
  const key = await deriveKey(passphrase, parsed.salt, parsed.iterations, ['decrypt']);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: parsed.nonce as BufferSource, additionalData: parsed.header as BufferSource, tagLength: 128 },
      key,
      file.subarray(SHARED_BACKUP_HEADER_BYTES) as BufferSource,
    );
  } catch {
    throw new Error('Wrong passphrase, or the backup file is damaged.');
  }
  try {
    return decoder.decode(plain);
  } catch {
    throw new Error('Backup contents are damaged.');
  }
}
