/**
 * Invoice numbering.
 *
 * Format: "{deviceId}-{sequence}", e.g. "A3K9QZ-000042".
 *
 * Embedding the device ID means two offline devices can both issue
 * invoice #42 without colliding when their data is later merged — the
 * full number ("A3K9QZ-000042" vs "B7P2LM-000042") stays unique. The
 * sequence itself is still per-device and strictly increasing, which
 * keeps per-device display ("invoice 42") simple and predictable.
 */

export interface InvoiceNumberParts {
  deviceId: string;
  sequence: number;
}

const SEQUENCE_PAD = 6;

export function formatInvoiceNumber(parts: InvoiceNumberParts): string {
  if (parts.sequence < 1 || !Number.isInteger(parts.sequence)) {
    throw new Error("Invoice sequence must be a positive integer");
  }
  const seq = String(parts.sequence).padStart(SEQUENCE_PAD, "0");
  return `${parts.deviceId}-${seq}`;
}

export function parseInvoiceNumber(invoiceNumber: string): InvoiceNumberParts {
  const match = /^([0-9A-Z]+)-(\d+)$/.exec(invoiceNumber);
  if (!match) {
    throw new Error(`Not a valid invoice number: ${invoiceNumber}`);
  }
  const [, deviceId, seqStr] = match as unknown as [string, string, string];
  return { deviceId, sequence: Number.parseInt(seqStr, 10) };
}

/** Pure function: given the last-used sequence for this device, returns the next. */
export function nextSequence(lastSequence: number): number {
  return lastSequence + 1;
}
