import { describe, expect, it } from 'vitest';
import { placeOfSupplyFor } from './billing';
import { BUILT_IN_CATEGORY_IDS } from './sharedSpec';
import {
  SHARED_TABLE_NAMES,
  deriveSharedId,
  fromSharedPayload,
  toSharedPayload,
  type SharedPayload,
  type SharedSourceSnapshot,
} from './sharedPayload';

import { sampleSnapshot } from './sharedFixtures';

async function roundTrip(snapshot: SharedSourceSnapshot): Promise<SharedSourceSnapshot> {
  const payload = await toSharedPayload({ snapshot, photos: [], createdAt: 123, appVersion: 'test' });
  // Go through JSON text, as the real file will.
  const parsed = JSON.parse(JSON.stringify(payload)) as SharedPayload;
  return fromSharedPayload(parsed);
}

describe('shared payload mapping (web)', () => {
  it('writes every shared table, even when empty', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(Object.keys(payload.tables).sort()).toEqual([...SHARED_TABLE_NAMES].sort());
    expect(payload.format).toBe('auxo-backup');
    expect(payload.version).toBe(1);
    expect(payload.shopName).toBe('Sample Shop');
  });

  it('splits nested children into their own tables with parent IDs', async () => {
    const { tables } = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.variants).toHaveLength(2);
    expect(tables.variants.every(v => v.productId === 'p-1')).toBe(true);
    expect(tables.invoiceLines).toHaveLength(2);
    expect(tables.invoiceLines.every(l => l.invoiceId === 'i-1' && typeof l.id === 'string')).toBe(true);
    expect(tables.payments[0]).toMatchObject({ invoiceId: 'i-1', method: 'CASH' });
    expect(tables.stockCountLines[0]).toMatchObject({ stockCountId: 'sc-1', expectedQuantity: 12, countedQuantity: 11 });
    expect(tables.dayClosings[0]).toMatchObject({ businessDate: '2026-11-02', netSalesPaise: '149700' });
  });

  it('never writes accounts or password material', async () => {
    const snapshot = { ...sampleSnapshot(), accounts: [{ id: 'acc', identifier: 'owner', hash: 'secret' }] } as unknown as SharedSourceSnapshot;
    const payload = await toSharedPayload({ snapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(payload.tables).not.toHaveProperty('accounts');
  });

  it('round-trips the sample shop through JSON: every original value comes back unchanged', async () => {
    const original = sampleSnapshot();
    const restored = await roundTrip(original);
    // Extra fields are allowed only where the export filled a default (checked below).
    expect(restored.shop).toMatchObject(original.shop as object);
    expect(restored.loyaltyRules).toEqual(original.loyaltyRules);
    expect(restored.categories).toEqual(original.categories);
    expect(restored.products).toMatchObject(original.products);
    expect(restored.invoices).toMatchObject(original.invoices);
    expect(restored.customers).toEqual(original.customers);
    expect(restored.customerLedger).toEqual(original.customerLedger);
    expect(restored.suppliers).toEqual(original.suppliers);
    expect(restored.purchaseOrders).toEqual(original.purchaseOrders);
    expect(restored.purchaseReceipts).toMatchObject(original.purchaseReceipts);
    expect(restored.dayClosings).toEqual(original.dayClosings);
    expect(restored.loyaltyLedger).toEqual(original.loyaltyLedger);
    expect(restored.heldBills).toMatchObject(original.heldBills);
    expect(restored.quotations).toEqual(original.quotations);
    expect(restored.stockCounts).toEqual(original.stockCounts);
    expect(restored.auditLog).toEqual(original.auditLog);
    expect(restored.movements).toEqual(original.movements);
  });

  it('only adds fields the export filled with defaults', async () => {
    const original = sampleSnapshot();
    const restored = await roundTrip(original);
    const added = (after: object, before: object) => Object.keys(after).filter(k => !(k in before)).sort();
    expect(added(restored.products[0]!, original.products[0]!)).toEqual(['available', 'gstRateBasisPoints']);
    expect(added(restored.invoices[0]!, original.invoices[0]!)).toEqual(['buyer', 'loyaltyDiscountPaise', 'loyaltyPointsRedeemed', 'note']);
    expect(added(restored.invoices[0]!.lines[0]!, original.invoices[0]!.lines[0]!)).toEqual(['customItem', 'hsnCode', 'mrpPaise']);
  });

  it('keeps line order when an invoice has several lines', async () => {
    const original = sampleSnapshot();
    const restored = await roundTrip(original);
    expect(restored.invoices[0]!.lines.map(l => l.variantId)).toEqual(['v-1', 'v-2']);
  });

  it('derives the same child IDs every time for the same parent', async () => {
    expect(await deriveSharedId('invoiceLine', 'i-1', '0')).toBe(await deriveSharedId('invoiceLine', 'i-1', '0'));
    expect(await deriveSharedId('invoiceLine', 'i-1', '0')).not.toBe(await deriveSharedId('invoiceLine', 'i-1', '1'));
    expect(await deriveSharedId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('refuses a payload from another format version', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(() => fromSharedPayload({ ...payload, version: 2 as 1 })).toThrow(/cannot read/);
  });

  it('refuses a payload missing a required table', async () => {
    const payload = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    const { heldBillLines: _removed, ...tables } = payload.tables;
    expect(() => fromSharedPayload({ ...payload, tables } as SharedPayload)).toThrow(/heldBillLines/);
  });

  it('fills place of supply for older invoices that do not store it', async () => {
    const snapshot = sampleSnapshot();
    const { placeOfSupply: _omit, ...oldInvoice } = snapshot.invoices[0]!;
    const { tables } = await toSharedPayload({ snapshot: { ...snapshot, invoices: [oldInvoice] } as SharedSourceSnapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.invoices[0]).toMatchObject({ placeOfSupply: '19' });
  });
});

describe('place of supply rule', () => {
  it('uses the buyer state for inter-state sales with a known buyer state', () => {
    expect(placeOfSupplyFor({ interState: true, buyer: { stateCode: '07' }, seller: { stateCode: '19' } })).toBe('07');
  });
  it('uses the seller state for in-state sales', () => {
    expect(placeOfSupplyFor({ interState: false, buyer: { stateCode: '07' }, seller: { stateCode: '19' } })).toBe('19');
  });
  it('falls back to the seller state when the buyer state is unknown', () => {
    expect(placeOfSupplyFor({ interState: true, buyer: null, seller: { stateCode: '19' } })).toBe('19');
  });

  it('renames web names to spec names and back (variant stock and sizes)', async () => {
    const { tables } = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.variants[0]).toMatchObject({ stockQuantity: 12, reorderQuantity: 10, netQuantityMilli: null, netQuantityUnit: null });
    expect(tables.variants[0]).not.toHaveProperty('stock');
    const withQty = sampleSnapshot();
    (withQty.products[0] as unknown as { variants: Array<Record<string, unknown>> }).variants[0]!.netQuantity = { amountMilli: 500, unit: 'MILLILITRE' };
    const restored = await roundTrip(withQty);
    expect((restored.products[0] as unknown as { variants: Array<Record<string, unknown>> }).variants[0]).toMatchObject({ stock: 12, netQuantity: { amountMilli: 500, unit: 'MILLILITRE' } });
  });

  it('moves web-only fields into org.auxo.web extensions and restores them', async () => {
    const snapshot = sampleSnapshot();
    (snapshot.customers[0] as unknown as Record<string, unknown>).loyaltyTier = 'gold';
    const { tables } = await toSharedPayload({ snapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.customers[0]).not.toHaveProperty('loyaltyTier');
    expect(tables.extensions).toContainEqual({ namespace: 'org.auxo.web', ownerType: 'customers', ownerId: 'c-1', key: 'fields', value: { loyaltyTier: 'gold' } });
    const restored = await roundTrip(snapshot);
    expect((restored.customers[0] as unknown as Record<string, unknown>).loyaltyTier).toBe('gold');
  });

  it('keeps the customer snapshot on invoices and the spec customerId column', async () => {
    const { tables } = await toSharedPayload({ snapshot: sampleSnapshot(), photos: [], createdAt: 1, appVersion: 'test' });
    expect(tables.invoices[0]).toMatchObject({ customerId: 'c-1' });
    expect(tables.invoices[0]).not.toHaveProperty('customer');
  });

  it('maps built-in categories to fixed UUIDs and back, including product references', async () => {
    const snapshot = sampleSnapshot();
    snapshot.categories = [{ id: 'GARMENT', name: null, profile: 'GARMENT', enabled: true, sortOrder: 0, builtIn: true, subcategories: [] }] as never;
    (snapshot.products[0] as unknown as { categoryId: string }).categoryId = 'GARMENT';
    const payload = await toSharedPayload({ snapshot, photos: [], createdAt: 1, appVersion: 'test' });
    expect(payload.tables.categories[0]).toMatchObject({ id: BUILT_IN_CATEGORY_IDS.GARMENT });
    expect(payload.tables.products[0]).toMatchObject({ categoryId: BUILT_IN_CATEGORY_IDS.GARMENT });
    const restored = fromSharedPayload(JSON.parse(JSON.stringify(payload)));
    expect(restored.categories[0]).toMatchObject({ id: 'GARMENT' });
    expect(restored.products[0]).toMatchObject({ categoryId: 'GARMENT' });
  });

  it('keeps the fixed built-in category UUIDs equal to their derived values', async () => {
    for (const [profile, id] of Object.entries(BUILT_IN_CATEGORY_IDS)) {
      expect(await deriveSharedId('builtin-category', profile)).toBe(id);
    }
  });
});
