// SPDX-License-Identifier: GPL-3.0-or-later
// Limits: AUXO Android temp domain/billing/SettingsValidator.kt.
export interface ShopIdentity { storeName: string; address: string }
export function validateShop(input: ShopIdentity): ShopIdentity {
  const storeName = input.storeName.trim();
  const address = input.address.trim();
  if (!storeName) throw new Error('Store name is required.');
  if (storeName.length > 70) throw new Error('Store name must be 70 characters or fewer.');
  if (address.length > 200) throw new Error('Address must be 200 characters or fewer.');
  return { storeName, address };
}
