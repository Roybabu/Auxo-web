import { lineSubtotal, lineTax, invoiceTotal, type Invoice } from "./invoice.js";
import type { ProductVariant } from "./product.js";
import type { UUID } from "./ids.js";

/**
 * Report math stays in core, as pure functions over data the caller
 * already has (completed invoices, current stock) — no I/O, so it's
 * testable without a database and reusable from any future surface
 * (desktop build, a future server) without rewriting it.
 */

export interface SalesSummary {
  invoiceCount: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
  averageSale: number;
}

/** Only ever pass completed invoices in — held/voided ones aren't sales. */
export function salesSummary(invoices: readonly Invoice[]): SalesSummary {
  let totalSales = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  for (const invoice of invoices) {
    totalSales += invoiceTotal(invoice);
    for (const line of invoice.lines) {
      totalTax += lineTax(line);
      totalDiscount += line.discountAmount;
    }
  }

  return {
    invoiceCount: invoices.length,
    totalSales,
    totalTax,
    totalDiscount,
    averageSale: invoices.length === 0 ? 0 : totalSales / invoices.length,
  };
}

export interface ProductSalesRank {
  productVariantId: UUID;
  quantitySold: number;
  revenue: number;
}

export function topProductsByQuantity(
  invoices: readonly Invoice[],
  limit = 10
): ProductSalesRank[] {
  const byVariant = new Map<UUID, ProductSalesRank>();
  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const existing = byVariant.get(line.productVariantId);
      const revenue = lineSubtotal(line) + lineTax(line);
      if (existing) {
        existing.quantitySold += line.quantity;
        existing.revenue += revenue;
      } else {
        byVariant.set(line.productVariantId, {
          productVariantId: line.productVariantId,
          quantitySold: line.quantity,
          revenue,
        });
      }
    }
  }
  return Array.from(byVariant.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

export interface CustomerSpendRank {
  customerId: UUID;
  invoiceCount: number;
  totalSpend: number;
}

/** Walk-in sales (customerId === null) are excluded — nothing to rank. */
export function topCustomersBySpend(invoices: readonly Invoice[], limit = 10): CustomerSpendRank[] {
  const byCustomer = new Map<UUID, CustomerSpendRank>();
  for (const invoice of invoices) {
    if (invoice.customerId === null) continue;
    const spend = invoiceTotal(invoice);
    const existing = byCustomer.get(invoice.customerId);
    if (existing) {
      existing.invoiceCount += 1;
      existing.totalSpend += spend;
    } else {
      byCustomer.set(invoice.customerId, { customerId: invoice.customerId, invoiceCount: 1, totalSpend: spend });
    }
  }
  return Array.from(byCustomer.values())
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit);
}

/** Current stock-on-hand valued at selling price — a point-in-time snapshot, not date-ranged. */
export function inventoryValue(
  variants: readonly ProductVariant[],
  stockByVariant: ReadonlyMap<UUID, number>
): number {
  return variants.reduce((sum, variant) => {
    const qty = stockByVariant.get(variant.id) ?? 0;
    return sum + qty * variant.sellingPrice;
  }, 0);
}
