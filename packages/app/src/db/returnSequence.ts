import { formatInvoiceNumber, nextSequence } from "@auxo/core";
import { getRepositories } from "./repositories.js";
import { getOrCreateDeviceId } from "./deviceId.js";

/**
 * Allocates the next return number for this device, same scheme and
 * reasoning as invoiceSequence.ts/purchaseSequence.ts — its own
 * per-device counter namespace so it never collides with either.
 */
export async function allocateNextReturnNumber(): Promise<string> {
  const repos = getRepositories();
  const deviceId = await getOrCreateDeviceId(repos.settings);
  const key = `return_sequence_${deviceId}`;
  const lastRaw = await repos.settings.get(key);
  const last = lastRaw ? Number.parseInt(lastRaw, 10) : 0;
  const next = nextSequence(last);
  await repos.settings.set(key, String(next));
  return formatInvoiceNumber({ deviceId, sequence: next });
}
