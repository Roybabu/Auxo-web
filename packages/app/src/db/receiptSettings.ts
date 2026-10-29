import { getRepositories } from "./repositories.js";

export interface ReceiptSettings {
  paperWidthMm: 56 | 76 | 80;
  footerText: string;
  showLogo: boolean;
  /** Shows the tagline and GSTIN/FSSAI numbers under the shop name, when set. */
  showShopDetails: boolean;
  showTaxDetails: boolean;
  /** A visual bar pattern under the invoice number — not a scannable barcode. */
  showBarcode: boolean;
}

const KEY = "receipt_settings";

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperWidthMm: 80,
  footerText: "We'd love your feedback — thank you for shopping with us!",
  showLogo: true,
  showShopDetails: true,
  showTaxDetails: true,
  showBarcode: false,
};

export async function getReceiptSettings(): Promise<ReceiptSettings> {
  const raw = await getRepositories().settings.get(KEY);
  if (!raw) return DEFAULT_RECEIPT_SETTINGS;
  try {
    return { ...DEFAULT_RECEIPT_SETTINGS, ...(JSON.parse(raw) as Partial<ReceiptSettings>) };
  } catch {
    return DEFAULT_RECEIPT_SETTINGS;
  }
}

export async function setReceiptSettings(settings: ReceiptSettings): Promise<void> {
  await getRepositories().settings.set(KEY, JSON.stringify(settings));
}
