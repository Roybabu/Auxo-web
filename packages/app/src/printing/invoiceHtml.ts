import {
  impliedDiscount,
  invoiceTotal,
  lineSubtotal,
  lineTax,
  maskPhoneForInvoice,
  type Business,
  type Customer,
  type Invoice,
  type Product,
  type ProductVariant,
} from "@auxo/core";

export interface ReceiptPrintSettings {
  paperWidthMm: 58 | 80;
  footerText: string;
}

const DEFAULT_RECEIPT_PRINT_SETTINGS: ReceiptPrintSettings = {
  paperWidthMm: 80,
  footerText: "We'd love your feedback — thank you for shopping with us!",
};

export interface InvoicePrintParams {
  invoice: Invoice;
  business: Business;
  customer: Customer | null;
  variants: readonly ProductVariant[];
  products: readonly Product[];
  receiptSettings?: ReceiptPrintSettings;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds a standalone, print-ready HTML document for one invoice.
 * Rules carried over from the Android app's invoice copy:
 * - the customer's phone has its last 6 digits hidden
 * - when a variant's MRP differs from the selling price, that gap is
 *   shown explicitly as a discount, never just a quietly different price
 * - no "place of supply" line
 * - ends with a request for feedback
 */
export function buildInvoiceHtmlDocument(params: InvoicePrintParams): string {
  const { invoice, business, customer, variants, products } = params;
  const receiptSettings = params.receiptSettings ?? DEFAULT_RECEIPT_PRINT_SETTINGS;
  const maxWidthPx = receiptSettings.paperWidthMm === 58 ? 260 : 400;

  const variantById = new Map(variants.map((v) => [v.id, v]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const rows = invoice.lines
    .map((line) => {
      const variant = variantById.get(line.productVariantId);
      const product = variant ? productById.get(variant.productId) : undefined;
      const name = variant && product ? `${product.name} — ${variant.name}` : "Item";
      const subtotal = lineSubtotal(line);
      const tax = lineTax(line);
      const savedOnMrp = variant ? impliedDiscount(variant) * line.quantity : 0;

      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td class="num">${line.quantity}</td>
          <td class="num">₹${line.unitPrice.toFixed(2)}</td>
          <td class="num">₹${line.discountAmount.toFixed(2)}</td>
          <td class="num">${line.taxRatePercent}%</td>
          <td class="num">₹${(subtotal + tax).toFixed(2)}</td>
        </tr>
        ${
          savedOnMrp > 0
            ? `<tr class="saved-row"><td colspan="6">You saved ₹${savedOnMrp.toFixed(2)} off MRP on this item</td></tr>`
            : ""
        }
      `;
    })
    .join("");

  const total = invoiceTotal({ lines: invoice.lines });
  const balanceDue = total - invoice.amountPaid;
  const customerPhone = customer?.phone ? maskPhoneForInvoice(customer.phone) : null;

  const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
    paid: "Paid in full",
    part_paid: "Partially paid",
    on_credit: "On credit",
    return: "Returned",
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  :root { --emerald: #167d55; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 2rem; max-width: ${maxWidthPx}px; }
  h1 { color: var(--emerald); margin: 0 0 0.25rem; }
  .tagline { color: #0f5c3e; margin: 0 0 0.25rem; font-size: 0.9rem; }
  .biz-reg { color: #555; margin: 0 0 0.25rem; font-size: 0.8rem; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.9rem; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
  th, td { padding: 0.4rem 0.3rem; border-bottom: 1px solid #eee; text-align: left; }
  .num { text-align: right; }
  .saved-row td { color: var(--emerald); font-size: 0.8rem; border-bottom: 1px solid #eee; }
  .totals { margin-left: auto; width: 260px; font-size: 0.95rem; }
  .totals div { display: flex; justify-content: space-between; padding: 0.2rem 0; }
  .totals .grand { font-weight: 700; font-size: 1.1rem; border-top: 1px solid #ccc; margin-top: 0.3rem; padding-top: 0.5rem; }
  .status { margin-top: 0.5rem; font-weight: 600; }
  .feedback { margin-top: 2rem; text-align: center; color: #555; font-size: 0.85rem; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(business.name)}</h1>
  <p class="tagline">Built to grow.</p>
  ${business.gstin ? `<p class="biz-reg">GSTIN: ${escapeHtml(business.gstin)}</p>` : ""}
  ${business.fssaiNumber ? `<p class="biz-reg">FSSAI: ${escapeHtml(business.fssaiNumber)}</p>` : ""}
  <div class="meta">
    <div>
      <div><strong>Invoice:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
      <div><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleString()}</div>
    </div>
    <div>
      <div><strong>Bill to:</strong> ${customer ? escapeHtml(customer.name) : "Walk-in customer"}</div>
      ${customerPhone ? `<div>${escapeHtml(customerPhone)}</div>` : ""}
      ${invoice.tableNumber ? `<div><strong>Table:</strong> ${escapeHtml(invoice.tableNumber)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Discount</th><th class="num">Tax</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Total</span><span>₹${total.toFixed(2)}</span></div>
    <div><span>Paid</span><span>₹${invoice.amountPaid.toFixed(2)}</span></div>
    <div class="grand"><span>Balance due</span><span>₹${balanceDue.toFixed(2)}</span></div>
  </div>
  <p class="status">${paymentStatusLabel[invoice.paymentStatus]}</p>

  <p class="feedback">${escapeHtml(receiptSettings.footerText)}</p>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}
