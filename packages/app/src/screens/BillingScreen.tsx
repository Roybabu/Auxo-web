import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyPointsDelta,
  computePaymentStatus,
  invoiceBalanceDue,
  invoiceTotal,
  lineSubtotal,
  lineTax,
  newInvoice,
  newInvoiceLine,
  newStockMovement,
  pointsEarnedForSale,
  stockByVariant,
  type Business,
  type Category,
  type Customer,
  type Employee,
  type Invoice,
  type InvoiceLine,
  type PaymentMethod,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Receipt as ReceiptIcon,
  X,
  Search,
  ScanLine,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  Clock,
  Zap,
  Undo2,
  BarChart3,
  Wifi,
  WifiOff,
  Printer,
} from "lucide-react";
import { getRepositories } from "../db/repositories.js";
import { getOrCreateDeviceId } from "../db/deviceId.js";
import { allocateNextInvoiceNumber } from "../db/invoiceSequence.js";
import { buildInvoiceHtmlDocument } from "../printing/invoiceHtml.js";
import { logActivity } from "../db/activityLog.js";
import ProductThumb from "../components/ProductThumb.js";
import { getReceiptSettings } from "../db/receiptSettings.js";
import { getPaymentMethodSettings } from "../db/paymentMethodSettings.js";
import { getLoyaltySettings } from "../db/loyaltySettings.js";

interface CartLine {
  productVariantId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRatePercent: number;
}

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
  credit: ReceiptIcon,
};

/** A handful of round "amount received" suggestions at or above the total, for fast cash entry. */
function quickAmounts(amount: number): number[] {
  if (amount <= 0) return [];
  const suggestions = new Set<number>([Math.ceil(amount)]);
  for (const step of [100, 500, 1000, 2000, 5000]) {
    const rounded = Math.ceil(amount / step) * step;
    if (rounded > amount) suggestions.add(rounded);
  }
  return Array.from(suggestions)
    .sort((a, b) => a - b)
    .slice(0, 4);
}

interface BillingScreenProps {
  business: Business;
  currentEmployee: Employee;
  canVoid: boolean;
  onNavigate?: (section: string) => void;
}

/** Live HH:MM clock + online/offline flag for the POS status bar. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return { now, online };
}

export default function BillingScreen({ business, currentEmployee, canVoid, onNavigate }: BillingScreenProps) {
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PaymentMethod[]>(["cash"]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [resumingInvoice, setResumingInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<Invoice | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"review" | "payment">("review");
  const [paperWidthMm, setPaperWidthMm] = useState<56 | 76 | 80>(80);

  const searchRef = useRef<HTMLInputElement>(null);
  const { now, online } = useClock();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "F4" && checkoutOpen && checkoutStep === "payment" && !submitting) {
        e.preventDefault();
        void completeSale();
      } else if (e.key === "F2" && !checkoutOpen) {
        e.preventDefault();
        void holdSale();
      } else if (e.key === "F3" && !checkoutOpen) {
        e.preventDefault();
        onNavigate?.("history");
      } else if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  async function refreshAll() {
    const repos = getRepositories();
    const [prods, vars, cats, custs, invoices, moves, paymentSettings, receiptSettings] = await Promise.all([
      repos.products.list(),
      repos.productVariants.list(),
      repos.categories.list(),
      repos.customers.list(),
      repos.invoices.list(),
      repos.stockMovements.list(),
      getPaymentMethodSettings(),
      getReceiptSettings(),
    ]);
    setProducts(prods);
    setVariants(vars);
    setCategories(cats);
    setCustomers(custs);
    setHeldInvoices(invoices.filter((i) => i.status === "held"));
    setMovements(moves);
    setEnabledPaymentMethods(paymentSettings.enabledMethods);
    setPaperWidthMm(receiptSettings.paperWidthMm);
    setPaymentMethod((prev) =>
      paymentSettings.enabledMethods.includes(prev) ? prev : paymentSettings.enabledMethods[0] ?? "cash"
    );
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

  function categoryNameFor(variant: ProductVariant): string | null {
    const product = productOf(variant);
    if (!product?.categoryId) return null;
    return categories.find((c) => c.id === product.categoryId)?.name ?? null;
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
    setPaymentMethod(enabledPaymentMethods[0] ?? "cash");
    setResumingInvoice(null);
    setError(null);
    setCompleted(null);
    setCheckoutOpen(false);
    setCheckoutStep("review");
  }

  function openCheckout() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item before checking out.");
      return;
    }
    setCheckoutStep("review");
    setCheckoutOpen(true);
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
          paymentMethod,
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
          paymentMethod,
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

      if (invoice.customerId) {
        const loyaltySettings = await getLoyaltySettings();
        const earned = pointsEarnedForSale(invoiceTotal({ lines: invoice.lines }), loyaltySettings);
        if (earned > 0) {
          const loyaltyCustomer = customers.find((c) => c.id === invoice.customerId);
          if (loyaltyCustomer) {
            const updatedCustomer = {
              ...loyaltyCustomer,
              loyaltyPoints: applyPointsDelta(loyaltyCustomer.loyaltyPoints, earned),
            };
            await repos.customers.save(updatedCustomer);
            void logActivity({
              employeeId: currentEmployee.id,
              action: "loyalty.earned",
              summary: `${loyaltyCustomer.name} earned ${earned} point(s) from sale ${invoice.invoiceNumber}`,
            });
          }
        }
      }

      setCompleted(invoice);
      setCart([]);
      setCheckoutOpen(false);
      await refreshAll();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "sale.completed",
        summary: `Completed sale ${invoice.invoiceNumber} for ₹${invoiceTotal({ lines: invoice.lines }).toFixed(2)}`,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      });
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
    void logActivity({
      employeeId: currentEmployee.id,
      action: "sale.voided",
      summary: `Voided held bill ${invoice.invoiceNumber}`,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });
  }

  async function printCompleted() {
    if (!completed) return;
    const customer = completed.customerId ? customers.find((c) => c.id === completed.customerId) ?? null : null;
    const receiptSettings = await getReceiptSettings();
    const html = buildInvoiceHtmlDocument({ invoice: completed, business, customer, variants, products, receiptSettings });
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
          <button type="button" onClick={() => void printCompleted()}>
            Print receipt
          </button>
          <button type="button" onClick={resetCart}>
            New sale
          </button>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="pos-screen">
      <div className="pos-topbar">
        <div className="pos-search-field">
          <Search size={16} className="pos-search-icon" />
          <input
            ref={searchRef}
            placeholder="Search products, barcode or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <button type="button" className="pos-topbar-button" onClick={() => searchRef.current?.focus()}>
          <ScanLine size={16} />
          Scan <kbd>Ctrl+K</kbd>
        </button>
        <button type="button" className="pos-topbar-button" onClick={() => onNavigate?.("products")}>
          <Plus size={16} />
          New Product
        </button>
        <button type="button" className="pos-topbar-button" onClick={() => void holdSale()} disabled={submitting}>
          <PauseCircle size={16} />
          Hold Bill <kbd>F2</kbd>
        </button>
        <button type="button" className="pos-topbar-button" onClick={() => onNavigate?.("history")}>
          <Clock size={16} />
          Recent Bills <kbd>F3</kbd>
        </button>
      </div>

      <div className="quick-actions pos-quick-actions">
        <button type="button" className="quick-action-button" onClick={() => searchRef.current?.focus()}>
          <Zap size={16} />
          <span>
            <strong>Fast Billing</strong>
            <small>Scan or search products</small>
          </span>
        </button>
        <button type="button" className="quick-action-button" onClick={() => onNavigate?.("products")}>
          <Plus size={16} />
          <span>
            <strong>New Product</strong>
            <small>Add product quickly</small>
          </span>
        </button>
        <button type="button" className="quick-action-button" onClick={() => onNavigate?.("returns")}>
          <Undo2 size={16} />
          <span>
            <strong>Return / Exchange</strong>
            <small>Process returns</small>
          </span>
        </button>
        <button type="button" className="quick-action-button" onClick={() => onNavigate?.("dayClosing")}>
          <BarChart3 size={16} />
          <span>
            <strong>Daily Summary</strong>
            <small>View today's sales</small>
          </span>
        </button>
      </div>

      <div className="billing-screen">
      <section className="billing-picker">
        <h2>Items</h2>
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
                <ProductThumb name={productName(variant.productId)} categoryName={categoryNameFor(variant)} size={40} />
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
        <h2>
          {resumingInvoice ? `Resuming ${resumingInvoice.invoiceNumber}` : "Current sale"}
          {cartCount > 0 && <span className="pos-cart-count">{cartCount}</span>}
        </h2>
        <ul className="cart-list">
          {cart.map((line, index) => (
            <li key={line.productVariantId} className="cart-row">
              <ProductThumb name={line.label} categoryName={null} size={32} />
              <span className="cart-label">{line.label}</span>
              <div className="cart-qty-stepper">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => updateLine(index, { quantity: Math.max(1, line.quantity - 1) })}
                >
                  <Minus size={12} />
                </button>
                <span>{line.quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => updateLine(index, { quantity: line.quantity + 1 })}
                >
                  <Plus size={12} />
                </button>
              </div>
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
              <button type="button" onClick={() => removeLine(index)} aria-label="Remove item" className="cart-remove-button">
                <Trash2 size={14} />
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
        </div>

        <div className="billing-totals">
          <span>Total: ₹{total.toFixed(2)}</span>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="billing-actions">
          <button type="button" className="checkout-button" onClick={openCheckout} disabled={submitting || cart.length === 0}>
            Proceed to Payment → <kbd>F4</kbd>
          </button>
          {cart.length > 0 && (
            <button type="button" onClick={resetCart} disabled={submitting}>
              Clear
            </button>
          )}
        </div>
      </section>
      </div>

      <div className="pos-statusbar">
        <span>
          {now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className={`pos-status-online ${online ? "online" : "offline"}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online ? "Online" : "Offline"}
        </span>
        <span className="pos-statusbar-shortcuts">
          <strong>Shortcuts:</strong> <kbd>F2</kbd> Hold Bill <kbd>F3</kbd> Recent Bills <kbd>F4</kbd> Checkout{" "}
          <kbd>Ctrl+K</kbd> Focus Search
        </span>
        <span className="pos-statusbar-printer">
          <Printer size={13} />
          Receipt paper {paperWidthMm}mm
        </span>
      </div>

      {checkoutOpen && (
        <div className="checkout-modal-overlay" onClick={() => setCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <div className="checkout-steps">
                <span className={`checkout-step ${checkoutStep === "review" ? "active" : "done"}`}>1. Review</span>
                <span className={`checkout-step ${checkoutStep === "payment" ? "active" : ""}`}>2. Payment</span>
              </div>
              <button
                type="button"
                className="checkout-modal-close"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {checkoutStep === "review" && (
              <div className="checkout-modal-body">
                <h3>Bill summary</h3>
                <ul className="checkout-bill-list">
                  {cart.map((line) => (
                    <li key={line.productVariantId}>
                      <ProductThumb name={line.label} categoryName={null} size={32} />
                      <span className="checkout-bill-name">{line.label}</span>
                      <span className="muted">
                        {line.quantity} × ₹{line.unitPrice}
                      </span>
                      <span>₹{(lineSubtotal(line) + lineTax(line)).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="checkout-totals">
                  <div>
                    <span>Subtotal</span>
                    <span>₹{cart.reduce((s, l) => s + lineSubtotal(l), 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span>Discount</span>
                    <span>₹{cart.reduce((s, l) => s + l.discountAmount, 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span>Tax</span>
                    <span>₹{cart.reduce((s, l) => s + lineTax(l), 0).toFixed(2)}</span>
                  </div>
                  <div className="checkout-total-grand">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setCheckoutStep("payment")}>
                  Continue to Payment →
                </button>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="checkout-modal-body">
                <h3>Select payment method</h3>
                <div className="payment-method-tiles">
                  {enabledPaymentMethods.map((method) => {
                    const Icon = PAYMENT_METHOD_ICONS[method];
                    return (
                      <button
                        key={method}
                        type="button"
                        className={`payment-method-tile ${paymentMethod === method ? "selected" : ""}`}
                        onClick={() => setPaymentMethod(method)}
                      >
                        <Icon size={20} />
                        {method === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1)}
                      </button>
                    );
                  })}
                </div>

                <label>
                  Amount received
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={total.toFixed(2)}
                  />
                </label>
                <div className="quick-amounts">
                  {quickAmounts(total).map((amt) => (
                    <button type="button" key={amt} onClick={() => setAmountPaid(String(amt))}>
                      ₹{amt}
                    </button>
                  ))}
                </div>

                <div className="checkout-totals">
                  <div>
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const remainder = invoiceBalanceDue({
                      lines: cart,
                      amountPaid: amountPaid.trim() === "" ? 0 : Number(amountPaid),
                    });
                    const changeDue = remainder < 0;
                    return (
                      <div className="checkout-total-grand">
                        <span>{changeDue ? "Change due" : "Balance due"}</span>
                        <span>₹{Math.abs(remainder).toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>

                {error && <p className="error">{error}</p>}

                <div className="checkout-modal-actions">
                  <button type="button" onClick={() => setCheckoutStep("review")} disabled={submitting}>
                    ← Back
                  </button>
                  <button type="button" onClick={() => void completeSale()} disabled={submitting}>
                    {submitting ? "Working…" : "Complete Sale (F4)"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
