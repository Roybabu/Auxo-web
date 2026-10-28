import { useEffect, useMemo, useState } from "react";
import {
  invoiceBalanceDue,
  invoiceTotal,
  lineSubtotal,
  lineTax,
  type Business,
  type Customer,
  type Invoice,
  type Product,
  type ProductVariant,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { buildInvoiceHtmlDocument } from "../printing/invoiceHtml.js";

interface InvoiceHistoryScreenProps {
  business: Business;
}

export default function InvoiceHistoryScreen({ business }: InvoiceHistoryScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const repos = getRepositories();
      const [invs, custs, vars, prods] = await Promise.all([
        repos.invoices.list(),
        repos.customers.list(),
        repos.productVariants.list(),
        repos.products.list(),
      ]);
      setInvoices(
        invs
          .filter((i) => i.status === "completed" || i.status === "voided")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
      setCustomers(custs);
      setVariants(vars);
      setProducts(prods);
      setLoading(false);
    })();
  }, []);

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((invoice) => {
      const customer = invoice.customerId ? customerById.get(invoice.customerId) : null;
      return (
        invoice.invoiceNumber.toLowerCase().includes(term) ||
        (customer?.name.toLowerCase().includes(term) ?? false)
      );
    });
  }, [search, invoices, customerById]);

  function printInvoice(invoice: Invoice) {
    const customer = invoice.customerId ? customerById.get(invoice.customerId) ?? null : null;
    const html = buildInvoiceHtmlDocument({ invoice, business, customer, variants, products });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      alert("Your browser blocked the print preview window. Allow pop-ups for this site to print invoices.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (loading) return <p className="muted">Loading invoice history…</p>;

  const selectedInvoice = selectedId ? invoices.find((i) => i.id === selectedId) ?? null : null;

  if (selectedInvoice) {
    return (
      <InvoiceDetails
        invoice={selectedInvoice}
        customer={selectedInvoice.customerId ? customerById.get(selectedInvoice.customerId) ?? null : null}
        variants={variants}
        products={products}
        onBack={() => setSelectedId(null)}
        onPrint={() => printInvoice(selectedInvoice)}
      />
    );
  }

  return (
    <div className="invoice-history-screen">
      <h2>Invoice history</h2>
      <div className="table-toolbar">
        <input
          placeholder="Search by invoice number or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((invoice) => {
            const customer = invoice.customerId ? customerById.get(invoice.customerId) : null;
            return (
              <tr key={invoice.id}>
                <td className="invoice-number">{invoice.invoiceNumber}</td>
                <td className="muted">{new Date(invoice.createdAt).toLocaleString()}</td>
                <td>{customer ? customer.name : "Walk-in"}</td>
                <td>₹{invoiceTotal({ lines: invoice.lines }).toFixed(2)}</td>
                <td>
                  <span className={`status-badge status-${invoice.status}`}>
                    {invoice.status === "voided" ? "Voided" : invoice.paymentStatus}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => setSelectedId(invoice.id)}>
                      View
                    </button>
                    <button type="button" onClick={() => printInvoice(invoice)}>
                      Print
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No invoices found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceDetails({
  invoice,
  customer,
  variants,
  products,
  onBack,
  onPrint,
}: {
  invoice: Invoice;
  customer: Customer | null;
  variants: ProductVariant[];
  products: Product[];
  onBack: () => void;
  onPrint: () => void;
}) {
  const variantLabel = (id: string) => {
    const variant = variants.find((v) => v.id === id);
    if (!variant) return "Unknown item";
    const product = products.find((p) => p.id === variant.productId);
    return product ? `${product.name} — ${variant.name}` : variant.name;
  };

  const total = invoiceTotal({ lines: invoice.lines });
  const balance = invoiceBalanceDue(invoice);

  return (
    <div className="invoice-history-screen">
      <button type="button" onClick={onBack} className="back-link">
        ← Back to invoice history
      </button>

      <section>
        <div className="invoice-details-header">
          <div>
            <h2>{invoice.invoiceNumber}</h2>
            <p className="muted">{new Date(invoice.createdAt).toLocaleString()}</p>
          </div>
          <span className={`status-badge status-${invoice.status}`}>
            {invoice.status === "voided" ? "Voided" : invoice.paymentStatus}
          </span>
        </div>
        <dl className="settings-dl">
          <dt>Customer</dt>
          <dd>{customer ? customer.name : "Walk-in"}</dd>
        </dl>
      </section>

      <section>
        <h2>Items</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{variantLabel(line.productVariantId)}</td>
                <td>{line.quantity}</td>
                <td>₹{line.unitPrice.toFixed(2)}</td>
                <td>{line.discountAmount ? `₹${line.discountAmount.toFixed(2)}` : "—"}</td>
                <td>{line.taxRatePercent}%</td>
                <td>₹{(lineSubtotal(line) + lineTax(line)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="report-cards">
          <div className="report-card">
            <span className="muted">Total</span>
            <strong>₹{total.toFixed(2)}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Paid</span>
            <strong>₹{invoice.amountPaid.toFixed(2)}</strong>
          </div>
          <div className="report-card">
            <span className="muted">{balance > 0 ? "Balance due" : "Change due"}</span>
            <strong>₹{Math.abs(balance).toFixed(2)}</strong>
          </div>
        </div>
      </section>

      <button type="button" onClick={onPrint}>
        Print receipt
      </button>
    </div>
  );
}
