import { useEffect, useMemo, useState } from "react";
import {
  invoiceTotal,
  newCustomer,
  type Business,
  type Customer,
  type Employee,
  type Invoice,
  type Product,
  type ProductVariant,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { buildInvoiceHtmlDocument } from "../printing/invoiceHtml.js";
import { logActivity } from "../db/activityLog.js";

interface CustomersScreenProps {
  canEdit: boolean;
  business: Business;
  currentEmployee: Employee;
}

export default function CustomersScreen({ canEdit, business, currentEmployee }: CustomersScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const repos = getRepositories();
    const [custs, invs, vars, prods] = await Promise.all([
      repos.customers.list(),
      repos.invoices.list(),
      repos.productVariants.list(),
      repos.products.list(),
    ]);
    setCustomers(custs);
    setInvoices(invs);
    setVariants(vars);
    setProducts(prods);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").toLowerCase().includes(term)
    );
  }, [search, customers]);

  if (loading) return <p className="muted">Loading customers…</p>;

  const selectedCustomer = selectedId ? customers.find((c) => c.id === selectedId) ?? null : null;

  if (selectedCustomer) {
    return (
      <CustomerDetails
        customer={selectedCustomer}
        invoices={invoices.filter((i) => i.customerId === selectedCustomer.id)}
        business={business}
        variants={variants}
        products={products}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="customers-screen">
      <section>
        <h2>Customers</h2>
        <div className="table-toolbar">
          <input
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Credit limit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td className="muted">{c.phone || "—"}</td>
                <td>{c.creditLimit != null ? `₹${c.creditLimit}` : "—"}</td>
                <td>
                  <button type="button" onClick={() => setSelectedId(c.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canEdit && <AddCustomerForm currentEmployee={currentEmployee} onAdded={refresh} />}
      </section>
    </div>
  );
}

function CustomerDetails({
  customer,
  invoices,
  business,
  variants,
  products,
  onBack,
}: {
  customer: Customer;
  invoices: Invoice[];
  business: Business;
  variants: ProductVariant[];
  products: Product[];
  onBack: () => void;
}) {
  const completed = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "completed")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [invoices]
  );
  const totalSpent = useMemo(
    () => completed.reduce((sum, i) => sum + invoiceTotal({ lines: i.lines }), 0),
    [completed]
  );

  function printInvoice(invoice: Invoice) {
    const html = buildInvoiceHtmlDocument({ invoice, business, customer, variants, products });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      alert("Your browser blocked the print preview window. Allow pop-ups for this site to print invoices.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="customers-screen">
      <button type="button" onClick={onBack} className="back-link">
        ← Back to customers
      </button>

      <section>
        <h2>{customer.name}</h2>
        <dl className="settings-dl">
          <dt>Phone</dt>
          <dd>{customer.phone || "—"}</dd>
          <dt>Credit limit</dt>
          <dd>{customer.creditLimit != null ? `₹${customer.creditLimit}` : "—"}</dd>
        </dl>
      </section>

      <section>
        <div className="report-cards">
          <div className="report-card">
            <span className="muted">Total spent</span>
            <strong>₹{totalSpent.toFixed(2)}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Completed invoices</span>
            <strong>{completed.length}</strong>
          </div>
        </div>
      </section>

      <section>
        <h2>Purchase history</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {completed.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td className="muted">{new Date(invoice.createdAt).toLocaleString()}</td>
                <td>₹{invoiceTotal({ lines: invoice.lines }).toFixed(2)}</td>
                <td>
                  <span className={`status-badge status-${invoice.status}`}>{invoice.paymentStatus}</span>
                </td>
                <td>
                  <button type="button" onClick={() => printInvoice(invoice)}>
                    Print
                  </button>
                </td>
              </tr>
            ))}
            {completed.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No purchases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AddCustomerForm({
  currentEmployee,
  onAdded,
}: {
  currentEmployee: Employee;
  onAdded: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const customer = newCustomer({
        name,
        phone: phone || null,
        creditLimit: creditLimit.trim() === "" ? null : Number(creditLimit),
      });
      await getRepositories().customers.save(customer);
      setName("");
      setPhone("");
      setCreditLimit("");
      await onAdded();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "customer.created",
        summary: `Added customer "${customer.name}"`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-customer-form">
      <h3>Add customer</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Phone (optional)
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Credit limit (optional)
        <input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add customer"}
      </button>
    </form>
  );
}
