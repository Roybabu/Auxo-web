import { formatInvoiceNumber, nextSequence } from "@auxo/core";
import { getRepositories } from "./repositories.js";
import { getOrCreateDeviceId } from "./deviceId.js";

/**
 * Allocates the next purchase number for this device, using the same
 * "{deviceId}-{sequence}" scheme as invoices (formatInvoiceNumber is
 * generic despite the name) but counted in its own namespace so
 * purchase and invoice numbers never collide or share a counter.
 */
export async function allocateNextPurchaseNumber(): Promise<string> {
  const repos = getRepositories();
  const deviceId = await getOrCreateDeviceId(repos.settings);
  const key = `purchase_sequence_${deviceId}`;
  const lastRaw = await repos.settings.get(key);
  const last = lastRaw ? Number.parseInt(lastRaw, 10) : 0;
  const next = nextSequence(last);
  await repos.settings.set(key, String(next));
  return formatInvoiceNumber({ deviceId, sequence: next });
}
