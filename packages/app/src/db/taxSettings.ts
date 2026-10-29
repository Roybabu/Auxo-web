import { getRepositories } from "./repositories.js";

export interface TaxSettings {
  /** Prefilled as the default tax rate when adding a new product — not enforced, just a convenience. */
  defaultTaxRatePercent: number | null;
}

const KEY = "tax_settings";

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  defaultTaxRatePercent: null,
};

export async function getTaxSettings(): Promise<TaxSettings> {
  const raw = await getRepositories().settings.get(KEY);
  if (!raw) return DEFAULT_TAX_SETTINGS;
  try {
    return { ...DEFAULT_TAX_SETTINGS, ...(JSON.parse(raw) as Partial<TaxSettings>) };
  } catch {
    return DEFAULT_TAX_SETTINGS;
  }
}

export async function setTaxSettings(settings: TaxSettings): Promise<void> {
  await getRepositories().settings.set(KEY, JSON.stringify(settings));
}
