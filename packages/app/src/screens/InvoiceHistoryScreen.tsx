import { useEffect, useMemo, useState } from "react";
import {
  invoiceTotal,
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

  return (
    <div className="invoice-history-screen">
      <h2>Invoice history</h2>
      <input
        placeholder="Search by invoice number or customer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="invoice-search"
      />
      <ul className="invoice-list">
        {filtered.map((invoice) => {
          const customer = invoice.customerId ? customerById.get(invoice.customerId) : null;
          return (
            <li key={invoice.id} className="invoice-row">
              <span className="invoice-number">{invoice.invoiceNumber}</span>
              <span className="muted">{new Date(invoice.createdAt).toLocaleString()}</span>
              <span>{customer ? customer.name : "Walk-in"}</span>
              <span>₹{invoiceTotal({ lines: invoice.lines }).toFixed(2)}</span>
              <span className={`status-badge status-${invoice.status}`}>
                {invoice.status === "voided" ? "Voided" : invoice.paymentStatus}
              </span>
              <button type="button" onClick={() => printInvoice(invoice)}>
                Print
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="muted">No invoices found.</li>}
      </ul>
    </div>
  );
}
