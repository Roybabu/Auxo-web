import type { PaymentMethod } from "@auxo/core";
import { getRepositories } from "./repositories.js";

export interface PaymentMethodSettings {
  /** Which methods show up as options at checkout. Always non-empty — falls back to the defaults if cleared. */
  enabledMethods: PaymentMethod[];
}

const KEY = "payment_method_settings";

export const DEFAULT_PAYMENT_METHOD_SETTINGS: PaymentMethodSettings = {
  enabledMethods: ["cash", "card", "upi", "credit"],
};

export async function getPaymentMethodSettings(): Promise<PaymentMethodSettings> {
  const raw = await getRepositories().settings.get(KEY);
  if (!raw) return DEFAULT_PAYMENT_METHOD_SETTINGS;
  try {
    const parsed = { ...DEFAULT_PAYMENT_METHOD_SETTINGS, ...(JSON.parse(raw) as Partial<PaymentMethodSettings>) };
    if (!parsed.enabledMethods || parsed.enabledMethods.length === 0) {
      return DEFAULT_PAYMENT_METHOD_SETTINGS;
    }
    return parsed;
  } catch {
    return DEFAULT_PAYMENT_METHOD_SETTINGS;
  }
}

export async function setPaymentMethodSettings(settings: PaymentMethodSettings): Promise<void> {
  await getRepositories().settings.set(KEY, JSON.stringify(settings));
}
