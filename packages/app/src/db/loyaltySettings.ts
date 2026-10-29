import { DEFAULT_LOYALTY_SETTINGS, type LoyaltyProgramSettings } from "@auxo/core";
import { getRepositories } from "./repositories.js";

const KEY = "loyalty_settings";

export async function getLoyaltySettings(): Promise<LoyaltyProgramSettings> {
  const raw = await getRepositories().settings.get(KEY);
  if (!raw) return DEFAULT_LOYALTY_SETTINGS;
  try {
    return { ...DEFAULT_LOYALTY_SETTINGS, ...(JSON.parse(raw) as Partial<LoyaltyProgramSettings>) };
  } catch {
    return DEFAULT_LOYALTY_SETTINGS;
  }
}

export async function setLoyaltySettings(settings: LoyaltyProgramSettings): Promise<void> {
  await getRepositories().settings.set(KEY, JSON.stringify(settings));
}
