import type { CartLine, DiscountDraft } from './billing';
import type { Product } from './catalog';

export type QuotationCart = {
  lines: CartLine[];
  discount: DiscountDraft;
  interState: boolean;
  customerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerGstin: string;
};
export type QuotationRecord = {
  id: string;
  number: string;
  createdAt: number;
  validUntil: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  totalPaise: string;
  status: 'OPEN' | 'CONVERTED';
  convertedInvoiceId: string | null;
  cart: QuotationCart;
};

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function quotationValidUntil(date = new Date(), days = 15) {
  if (![7, 15, 30].includes(days)) throw new Error('Choose a quotation validity of 7, 15, or 30 days.');
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  end.setDate(end.getDate() + days);
  return localDateKey(end);
}
export function isQuotationExpired(quote: Pick<QuotationRecord, 'validUntil'>, today = localDateKey()) {
  return quote.validUntil < today;
}

/** Refresh saved product details from the current catalogue while preserving the quoted quantity and discounts. */
export function repriceQuotationCart(cart: QuotationCart, products: Product[]) {
  const lines = cart.lines.map(line => {
    if(line.customItem)return {...line};
    const product = products.find(candidate => candidate.id === line.productId);
    const variant = product?.variants.find(candidate => candidate.id === line.variantId);
    if (!product || !variant) return { ...line, availableStock: 0, unavailable: true };
    const current = {
      ...line,
      name: product.name,
      barcode: variant.barcode,
      hsnCode: product.hsnCode ?? null,
      unitPricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      stockUnit: product.stockUnit,
      gstRateBasisPoints: product.gstRateBasisPoints ?? null,
      apparelGst: product.apparelGst ?? false,
      restaurantItem: product.category === 'RESTAURANT',
      unavailable: product.category === 'RESTAURANT' && product.available === false,
      availableStock: product.category === 'RESTAURANT' && product.available === false ? 0 : product.tracksStock === false ? Number.MAX_SAFE_INTEGER : variant.stock,
    };
    return { ...current, quantity: line.quantity, lineDiscount: line.lineDiscount };
  });
  return { ...cart, lines };
}
