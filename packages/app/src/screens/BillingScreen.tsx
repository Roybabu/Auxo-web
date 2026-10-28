import { useEffect, useMemo, useRef, useState } from "react";
import {
  computePaymentStatus,
  invoiceBalanceDue,
  invoiceTotal,
  lineSubtotal,
  lineTax,
  newInvoice,
  newInvoiceLine,
  newStockMovement,
  stockByVariant,
  type Business,
  type Category,
  type Customer,
  type Employee,
  type Invoice,
  type InvoiceLine,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { getOrCreateDeviceId } from "../db/deviceId.js";
import { allocateNextInvoiceNumber } from "../db/invoiceSequence.js";
import { buildInvoiceHtmlDocument } from "../printing/invoiceHtml.js";

interface CartLine {
  productVariantId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRatePercent: number;
}

interface BillingScreenProps {
  business: Business;
  currentEmployee: Employee;
  canVoid: boolean;
}

export default function BillingScreen({ business, currentEmployee, canVoid }: BillingScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [heldInvoices, setHeldInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [tableNumber, setTableNumber] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [resumingInvoice, setResumingInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<Invoice | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  async function refreshAll() {
    const repos = getRepositories();
    const [prods, vars, cats, custs, invoices, moves] = await Promise.all([
      repos.products.list(),
      repos.productVariants.list(),
      repos.categories.list(),
      repos.customers.list(),
      repos.invoices.list(),
      repos.stockMovements.list(),
    ]);
    setProducts(prods);
    setVariants(vars);
    setCategories(cats);
    setCustomers(custs);
    setHeldInvoices(invoices.filter((i) => i.status === "held"));
    setMovements(moves);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    // Keep focus in the search box so a USB barcode scanner's keystrokes
    // (which arrive as fast keyboard input ending in Enter) always land here.
    searchRef.current?.focus();
  }, [completed]);

  const stock = useMemo(() => stockByVariant(movements), [movements]);

  function productOf(variant: ProductVariant): Product | undefined {
    return products.find((p) => p.id === variant.productId);
  }

  function productName(productId: string): string {
    return products.find((p) => p.id === productId)?.name ?? "Unknown product";
  }

  function variantLabel(variant: ProductVariant): string {
    return `${productName(variant.productId)} — ${variant.name}`;
  }

  const filteredVariants = useMemo(() => {
    const term = search.trim().toLowerCase();
    let pool = variants;
    if (categoryFilter) {
      pool = pool.filter((v) => productOf(v)?.categoryId === categoryFilter);
    }
    if (!term) return pool.slice(0, 24);
    return pool
      .filter((v) => {
        const label = variantLabel(v).toLowerCase();
        const barcode = (v.barcode ?? "").toLowerCase();
        const sku = (v.sku ?? "").toLowerCase();
        return label.includes(term) || barcode === term || sku === term;
      })
      .slice(0, 24);
  }, [search, categoryFilter, variants, products]);

  function addToCart(variant: ProductVariant) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productVariantId === variant.id);
      if (existing) {
        return prev.map((l) =>
          l.productVariantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      const product = productOf(variant);
      return [
        ...prev,
        {
          productVariantId: variant.id,
          label: variantLabel(variant),
          quantity: 1,
          unitPrice: variant.sellingPrice,
          discountAmount: 0,
          taxRatePercent: product?.taxRatePercent ?? 0,
        },
      ];
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // A barcode scanner "types" the code then Enter. If the search narrows
    // to exactly one item (by name, SKU, or barcode), add it straight away
    // instead of making the cashier click it.
    if (filteredVariants.length === 1) {
      addToCart(filteredVariants[0]!);
      setSearch("");
    }
  }

  function updateLine(index: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function resetCart() {
    setCart([]);
    setCustomerId("");
    setTableNumber("");
    setAmountPaid("");
    setResumingInvoice(null);
    setError(null);
    setCompleted(null);
  }

  const total = invoiceTotal({ lines: cart });

  function buildLines(): InvoiceLine[] {
    return cart.map((l) =>
      newInvoiceLine({
        productVariantId: l.productVariantId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        taxRatePercent: l.taxRatePercent,
      })
    );
  }

  async function holdSale() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item before holding the bill.");
      return;
    }
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const lines = buildLines();
      if (resumingInvoice) {
        const updated: Invoice = {
          ...resumingInvoice,
          lines,
          customerId: customerId || null,
          tableNumber: tableNumber.trim() || null,
          updatedAt: new Date().toISOString(),
        };
        await repos.invoices.save(updated);
      } else {
        const deviceId = await getOrCreateDeviceId(repos.settings);
        const invoiceNumber = await allocateNextInvoiceNumber();
        const invoice = newInvoice({
          invoiceNumber,
          customerId: customerId || null,
          employeeId: currentEmployee.id,
          lines,
          status: "held",
          tableNumber: tableNumber.trim() || null,
          createdDeviceId: deviceId,
        });
        await repos.invoices.save(invoice);
      }
      resetCart();
      await refreshAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function completeSale() {
    setError(null);
    if (submitting) return; // guards against a double-click submitting the same sale twice
    if (cart.length === 0) {
      setError("Add at least one item before completing the sale.");
      return;
    }
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const lines = buildLines();
      const paid = amountPaid.trim() === "" ? 0 : Number(amountPaid);

      let invoice: Invoice;
      if (resumingInvoice) {
        const invoiceTotalValue = invoiceTotal({ lines });
        invoice = {
          ...resumingInvoice,
          lines,
          customerId: customerId || null,
          tableNumber: tableNumber.trim() || null,
          amountPaid: paid,
          status: "completed",
          paymentStatus: computePaymentStatus(invoiceTotalValue, paid),
          updatedAt: new Date().toISOString(),
        };
      } else {
        const deviceId = await getOrCreateDeviceId(repos.settings);
        const invoiceNumber = await allocateNextInvoiceNumber();
        invoice = newInvoice({
          invoiceNumber,
          customerId: customerId || null,
          employeeId: currentEmployee.id,
          lines,
          status: "completed",
          tableNumber: tableNumber.trim() || null,
          amountPaid: paid,
          createdDeviceId: deviceId,
        });
      }
      await repos.invoices.save(invoice);

      for (const line of lines) {
        const movement = newStockMovement({
          productVariantId: line.productVariantId,
          quantityDelta: -line.quantity,
          reason: "sale",
          referenceId: invoice.id,
        });
        await repos.stockMovements.save(movement);
      }

      setCompleted(invoice);
      setCart([]);
      await refreshAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function resumeHeld(invoice: Invoice) {
    setCart(
      invoice.lines.map((line) => {
        const variant = variants.find((v) => v.id === line.productVariantId);
        return {
          productVariantId: line.productVariantId,
          label: variant ? variantLabel(variant) : "Unknown item",
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount,
          taxRatePercent: line.taxRatePercent,
        };
      })
    );
    setCustomerId(invoice.customerId ?? "");
    setTableNumber(invoice.tableNumber ?? "");
    setAmountPaid("");
    setResumingInvoice(invoice);
    setError(null);
  }

  async function voidHeld(invoice: Invoice) {
    const repos = getRepositories();
    await repos.invoices.save({ ...invoice, status: "voided", updatedAt: new Date().toISOString() });
    if (resumingInvoice?.id === invoice.id) resetCart();
    await refreshAll();
  }

  function printCompleted() {
    if (!completed) return;
    const customer = completed.customerId ? customers.find((c) => c.id === completed.customerId) ?? null : null;
    const html = buildInvoiceHtmlDocument({ invoice: completed, business, customer, variants, products });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (completed) {
    const completedTotal = invoiceTotal({ lines: completed.lines });
    const remainder = completedTotal - completed.amountPaid;
    const changeDue = remainder < 0;
    return (
      <div className="checkout-success">
        <div className="checkout-success-icon">✓</div>
        <h2>Sale complete</h2>
        <p className="muted">Invoice {completed.invoiceNumber}</p>
        <div className="checkout-success-amount">₹{completedTotal.toFixed(2)}</div>
        <dl className="settings-dl checkout-success-details">
          <dt>Paid</dt>
          <dd>₹{completed.amountPaid.toFixed(2)}</dd>
          <dt>{changeDue ? "Change due" : "Balance due"}</dt>
          <dd>₹{Math.abs(remainder).toFixed(2)}</dd>
        </dl>
        <div className="checkout-success-actions">
          <button type="button" onClick={printCompleted}>
            Print receipt
          </button>
          <button type="button" onClick={resetCart}>
            New sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-screen">
      <section className="billing-picker">
        <h2>Items</h2>
        <input
          ref={searchRef}
          placeholder="Search by name, SKU, or scan a barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {categories.length > 0 && (
          <div className="category-chips">
            <button
              type="button"
              className={categoryFilter === "" ? "chip active" : "chip"}
              onClick={() => setCategoryFilter("")}
            >
              All
            </button>
            {categories
              .filter((c) => c.enabled)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={categoryFilter === c.id ? "chip active" : "chip"}
                  onClick={() => setCategoryFilter(c.id)}
                >
                  {c.name}
                </button>
              ))}
          </div>
        )}

        <div className="pos-product-grid">
          {filteredVariants.map((variant) => {
            const qty = stock.get(variant.id) ?? 0;
            const stockClass = qty <= 0 ? "out" : qty <= 5 ? "low" : "ok";
            return (
              <button type="button" key={variant.id} className="pos-product-card" onClick={() => addToCart(variant)}>
                <span className="pos-product-name">{variantLabel(variant)}</span>
                <span className="pos-product-price">₹{variant.sellingPrice}</span>
                <span className={`pos-stock-badge ${stockClass}`}>
                  {qty <= 0 ? "Out of stock" : `${qty} in stock`}
                </span>
              </button>
            );
          })}
          {filteredVariants.length === 0 && <p className="muted">No products match.</p>}
        </div>

        {heldInvoices.length > 0 && (
          <>
            <h2>Held bills</h2>
            <ul className="held-list">
              {heldInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <span>
                    {invoice.invoiceNumber}
                    {invoice.tableNumber ? ` · Table ${invoice.tableNumber}` : ""}
                  </span>
                  <span className="held-actions">
                    <button type="button" onClick={() => resumeHeld(invoice)}>
                      Resume
                    </button>
                    {canVoid && (
                      <button type="button" onClick={() => void voidHeld(invoice)}>
                        Cancel
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="billing-cart">
        <h2>{resumingInvoice ? `Resuming ${resumingInvoice.invoiceNumber}` : "Current sale"}</h2>
        <ul className="cart-list">
          {cart.map((line, index) => (
            <li key={line.productVariantId} className="cart-row">
              <span className="cart-label">{line.label}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                aria-label="Quantity"
              />
              <span className="muted">× ₹{line.unitPrice}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.discountAmount}
                onChange={(e) => updateLine(index, { discountAmount: Number(e.target.value) })}
                aria-label="Discount"
                title="Discount"
              />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={line.taxRatePercent}
                onChange={(e) => updateLine(index, { taxRatePercent: Number(e.target.value) })}
                aria-label="Tax %"
                title="Tax %"
              />
              <span className="cart-line-total">
                ₹{(lineSubtotal(line) + lineTax(line)).toFixed(2)}
              </span>
              <button type="button" onClick={() => removeLine(index)} aria-label="Remove item">
                ✕
              </button>
            </li>
          ))}
          {cart.length === 0 && <li className="muted">Cart is empty — add items from the left.</li>}
        </ul>

        <div className="billing-form">
          <label>
            Customer (optional)
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Table (optional)
            <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
          </label>
          <label>
            Amount paid now
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={total.toFixed(2)}
            />
          </label>
        </div>

        <div className="billing-totals">
          <span>Total: ₹{total.toFixed(2)}</span>
          <span className="muted">
            {(() => {
              const remainder = invoiceBalanceDue({
                lines: cart,
                amountPaid: amountPaid.trim() === "" ? 0 : Number(amountPaid),
              });
              return remainder < 0
                ? `Change due: ₹${Math.abs(remainder).toFixed(2)}`
                : `Balance due: ₹${remainder.toFixed(2)}`;
            })()}
          </span>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="billing-actions">
          <button type="button" onClick={() => void holdSale()} disabled={submitting}>
            Hold
          </button>
          <button type="button" onClick={() => void completeSale()} disabled={submitting}>
            {submitting ? "Working…" : "Complete sale"}
          </button>
          {cart.length > 0 && (
            <button type="button" onClick={resetCart} disabled={submitting}>
              Clear
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
