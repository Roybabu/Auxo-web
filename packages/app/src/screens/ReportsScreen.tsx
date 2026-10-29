import { useEffect, useMemo, useState } from "react";
import {
  invoiceTotal,
  inventoryValue,
  salesSummary,
  stockByVariant,
  topCustomersBySpend,
  topProductsByQuantity,
  type Customer,
  type Invoice,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

type RangeOption = "today" | "week" | "month" | "all";

function rangeStart(option: RangeOption): Date | null {
  const now = new Date();
  if (option === "all") return null;
  if (option === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (option === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1); // month
}

export default function ReportsScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [range, setRange] = useState<RangeOption>("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const repos = getRepositories();
      const [invs, custs, vars, prods, moves] = await Promise.all([
        repos.invoices.list(),
        repos.customers.list(),
        repos.productVariants.list(),
        repos.products.list(),
        repos.stockMovements.list(),
      ]);
      setInvoices(invs);
      setCustomers(custs);
      setVariants(vars);
      setProducts(prods);
      setMovements(moves);
      setLoading(false);
    })();
  }, []);

  const completedInRange = useMemo(() => {
    const start = rangeStart(range);
    return invoices.filter((i) => {
      if (i.status !== "completed") return false;
      if (!start) return true;
      return new Date(i.createdAt) >= start;
    });
  }, [invoices, range]);

  const summary = useMemo(() => salesSummary(completedInRange), [completedInRange]);
  const topProducts = useMemo(() => topProductsByQuantity(completedInRange, 5), [completedInRange]);
  const topCustomers = useMemo(() => topCustomersBySpend(completedInRange, 5), [completedInRange]);
  const stock = useMemo(() => stockByVariant(movements), [movements]);
  const stockValue = useMemo(() => inventoryValue(variants, stock), [variants, stock]);

  function variantLabel(variantId: string): string {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return "Unknown item";
    const product = products.find((p) => p.id === variant.productId);
    return product ? `${product.name} — ${variant.name}` : variant.name;
  }

  function customerName(customerId: string): string {
    return customers.find((c) => c.id === customerId)?.name ?? "Unknown customer";
  }

  function csvEscape(value: string | number): string {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const header = ["Invoice", "Date", "Customer", "Total", "Tax", "Discount", "Payment status"];
    const rows = completedInRange.map((invoice) => {
      const tax = invoice.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice - line.discountAmount) * (line.taxRatePercent / 100), 0);
      const discount = invoice.lines.reduce((sum, line) => sum + line.discountAmount, 0);
      return [
        invoice.invoiceNumber,
        new Date(invoice.createdAt).toLocaleString(),
        invoice.customerId ? customerName(invoice.customerId) : "Walk-in",
        invoiceTotal({ lines: invoice.lines }).toFixed(2),
        tax.toFixed(2),
        discount.toFixed(2),
        invoice.paymentStatus,
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (loading) return <p className="muted">Loading reports…</p>;

  return (
    <div className="reports-screen">
      <div className="reports-toolbar">
        <div className="range-picker">
          {(["today", "week", "month", "all"] as RangeOption[]).map((option) => (
            <button
              key={option}
              type="button"
              className={range === option ? "tab active" : "tab"}
              onClick={() => setRange(option)}
            >
              {option === "today" ? "Today" : option === "week" ? "Last 7 days" : option === "month" ? "This month" : "All time"}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportCsv} disabled={completedInRange.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="report-cards">
        <div className="report-card">
          <span className="muted">Sales</span>
          <strong>₹{summary.totalSales.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Invoices</span>
          <strong>{summary.invoiceCount}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Avg. sale</span>
          <strong>₹{summary.averageSale.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Tax collected</span>
          <strong>₹{summary.totalTax.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Discounts given</span>
          <strong>₹{summary.totalDiscount.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Stock on hand (value)</span>
          <strong>₹{stockValue.toFixed(2)}</strong>
        </div>
      </div>

      <section>
        <h2>Top products</h2>
        {topProducts.length === 0 ? (
          <p className="muted">No sales in this range yet.</p>
        ) : (
          <ul className="rank-list">
            {topProducts.map((p) => (
              <li key={p.productVariantId}>
                <span>{variantLabel(p.productVariantId)}</span>
                <span className="muted">
                  {p.quantitySold} sold · ₹{p.revenue.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Top customers</h2>
        {topCustomers.length === 0 ? (
          <p className="muted">No customer sales in this range yet.</p>
        ) : (
          <ul className="rank-list">
            {topCustomers.map((c) => (
              <li key={c.customerId}>
                <span>{customerName(c.customerId)}</span>
                <span className="muted">
                  {c.invoiceCount} invoice(s) · ₹{c.totalSpend.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
