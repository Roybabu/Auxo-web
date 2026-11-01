// SPDX-License-Identifier: GPL-3.0-or-later
// Based on AUXO Android temp: domain/model/Money.kt. Monetary values are paise.
const MIN = -(1n << 63n);
const MAX = (1n << 63n) - 1n;
export function checkedMoney(value: bigint): bigint {
  if (value < MIN || value > MAX) throw new RangeError('Money exceeds signed 64-bit range.');
  return value;
}
export function parseMoney(text: string): bigint | null {
  const value = text.trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function formatMoney(paise: bigint): string {
  checkedMoney(paise);
  const absolute = paise < 0n ? -paise : paise;
  return `${paise < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2,'0')}`;
}
export function addMoney(a: bigint, b: bigint): bigint { return checkedMoney(checkedMoney(a) + checkedMoney(b)); }
