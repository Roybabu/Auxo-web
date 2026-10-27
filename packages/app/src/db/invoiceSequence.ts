import { formatInvoiceNumber, nextSequence } from "@auxo/core";
import { getRepositories } from "./repositories.js";
import { getOrCreateDeviceId } from "./deviceId.js";

/**
 * Allocates the next invoice number for this device. Stored as a plain
 * integer in settings keyed by this device's own ID, so two devices
 * never share (or need to coordinate) a sequence counter — each just
 * counts its own, and formatInvoiceNumber keeps the two namespaces
 * from colliding once/if a future sync brings them together.
 */
export async function allocateNextInvoiceNumber(): Promise<string> {
  const repos = getRepositories();
  const deviceId = await getOrCreateDeviceId(repos.settings);
  const key = `invoice_sequence_${deviceId}`;
  const lastRaw = await repos.settings.get(key);
  const last = lastRaw ? Number.parseInt(lastRaw, 10) : 0;
  const next = nextSequence(last);
  await repos.settings.set(key, String(next));
  return formatInvoiceNumber({ deviceId, sequence: next });
}
