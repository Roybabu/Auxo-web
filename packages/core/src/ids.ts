/**
 * ID generation.
 *
 * Every record gets a UUID. Invoice numbers additionally embed a short
 * per-device ID so that numbers generated offline on different devices
 * (e.g. two laptops in the same shop, later synced) never collide.
 */

export type UUID = string;

// Avoids depending on the "DOM" lib (core must not assume a browser
// environment) while still using the platform's crypto when present,
// in the browser, in Node, or in a Tauri webview.
interface CryptoLike {
  randomUUID?: () => string;
}

/** RFC4122 v4 UUID, using the platform's crypto when available. */
export function newId(): UUID {
  const platformCrypto = (globalThis as { crypto?: CryptoLike }).crypto;
  if (platformCrypto?.randomUUID) {
    return platformCrypto.randomUUID();
  }
  // Fallback (non-browser test environments without crypto.randomUUID).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEVICE_ID_LENGTH = 6;
const DEVICE_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O, 1/I/L ambiguity

/**
 * Generates a short, human-writable device ID (e.g. "A3K9QZ").
 * Callers are responsible for persisting this once per device/install
 * and reusing it — see @auxo/core's storage ports.
 */
export function newDeviceId(): string {
  let out = "";
  for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
    const idx = Math.floor(Math.random() * DEVICE_ID_ALPHABET.length);
    out += DEVICE_ID_ALPHABET[idx];
  }
  return out;
}
