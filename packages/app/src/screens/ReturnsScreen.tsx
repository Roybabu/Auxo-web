import { useEffect, useMemo, useState } from "react";
import {
  newReturn,
  newReturnLine,
  newStockMovement,
  returnTotal,
  returnedQuantityByVariant,
  type Customer,
  type Employee,
  type Invoice,
  type Product,
  type ProductVariant,
  type Return,
  type ReturnResolution,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { allocateNextReturnNumber } from "../db/returnSequence.js";

interface ReturnsScreenProps {
  canEdit: boolean;
  currentEmployee: Employee;
}

export default function ReturnsScreen({ canEdit, currentEmployee }: ReturnsScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const repos = getRepositories();
    const [invs, custs, vars, prods, rets] = await Promise.all([
      repos.invoices.list(),
      repos.customers.list(),
      repos.productVariants.list(),
      repos.products.list(),
      repos.returns.list(),
    ]);
    setInvoices(invs.filter((i) => i.status === "completed"));
    setCustomers(custs);
    setVariants(vars);
    setProducts(prods);
    setReturns(rets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const customerName = (id: string | null) => (id ? customers.find((c) => c.id === id)?.name ?? "Unknown customer" : "Walk-in");
  const variantLabel = (id: string) => {
    const variant = variants.find((v) => v.id === id);
    if (!variant) return "Unknown item";
    const product = products.find((p) => p.id === variant.productId);
    return product ? `${product.name} — ${variant.name}` : variant.name;
  };

  const matchingInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return invoices.filter((i) => i.invoiceNumber.toLowerCase().includes(term)).slice(0, 8);
  }, [search, invoices]);

  const selectedInvoice = selectedInvoiceId ? invoices.find((i) => i.id === selectedInvoiceId) ?? null : null;

  if (loading) return <p className="muted">Loading returns…</p>;

  return (
    <div className="returns-screen">
      {canEdit && (
        <section>
          <h2>Process a return</h2>
          {!selectedInvoice ? (
            <div className="table-toolbar">
              <input
                placeholder="Search by invoice number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          ) : null}
          {!selectedInvoice && matchingInvoices.length > 0 && (
            <ul className="movement-list">
              {matchingInvoices.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.invoiceNumber} — {customerName(i.customerId)}
                  </span>
                  <span className="muted">{new Date(i.createdAt).toLocaleDateString()}</span>
                  <button type="button" onClick={() => setSelectedInvoiceId(i.id)}>
                    Select
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedInvoice && (
            <ReturnForm
              invoice={selectedInvoice}
              customerName={customerName(selectedInvoice.customerId)}
              variantLabel={variantLabel}
              existingReturns={returns.filter((r) => r.invoiceId === selectedInvoice.id)}
              currentEmployee={currentEmployee}
              onDone={async () => {
                setSelectedInvoiceId(null);
                setSearch("");
                await refresh();
              }}
              onCancel={() => setSelectedInvoiceId(null)}
            />
          )}
        </section>
      )}

      <section>
        <h2>Returns &amp; credit notes</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Return</th>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Refund</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id}>
                <td>{r.returnNumber}</td>
                <td className="muted">{invoices.find((i) => i.id === r.invoiceId)?.invoiceNumber ?? "—"}</td>
                <td>{customerName(r.customerId)}</td>
                <td className="muted">{new Date(r.createdAt).toLocaleString()}</td>
                <td>₹{returnTotal({ lines: r.lines }).toFixed(2)}</td>
                <td>
                  <span className={`status-badge ${r.resolution === "store_credit" ? "status-credit" : ""}`}>
                    {r.resolution === "store_credit" ? "Credit note" : "Cash refund"}
                  </span>
                </td>
              </tr>
            ))}
            {returns.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No returns recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ReturnForm({
  invoice,
  customerName,
  variantLabel,
  existingReturns,
  currentEmployee,
  onDone,
  onCancel,
}: {
  invoice: Invoice;
  customerName: string;
  variantLabel: (id: string) => string;
  existingReturns: Return[];
  currentEmployee: Employee;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const alreadyReturned = useMemo(() => returnedQuantityByVariant(existingReturns), [existingReturns]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<ReturnResolution>("cash_refund");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remainingByLine = invoice.lines.map((line) => ({
    line,
    remaining: line.quantity - (alreadyReturned.get(line.productVariantId) ?? 0),
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const lines = remainingByLine
        .map(({ line }) => {
          const qty = Number(quantities[line.id] ?? "0");
          if (!qty) return null;
          return newReturnLine({
            productVariantId: line.productVariantId,
            quantity: qty,
            unitPrice: line.unitPrice,
          });
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      if (lines.length === 0) {
        setError("Enter a return quantity for at least one item.");
        return;
      }
      for (const { line, remaining } of remainingByLine) {
        const qty = Number(quantities[line.id] ?? "0");
        if (qty > remaining) {
          setError(`${variantLabel(line.productVariantId)}: can't return more than ${remaining} remaining.`);
          return;
        }
      }

      setSubmitting(true);
      const repos = getRepositories();
      const returnNumber = await allocateNextReturnNumber();
      const ret = newReturn({
        returnNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        employeeId: currentEmployee.id,
        lines,
        resolution,
        note: note || null,
      });
      await repos.returns.save(ret);

      for (const line of lines) {
        const movement = newStockMovement({
          productVariantId: line.productVariantId,
          quantityDelta: line.quantity,
          reason: "sale_return",
          referenceId: ret.id,
        });
        await repos.stockMovements.save(movement);
      }

      await repos.invoices.save({ ...invoice, paymentStatus: "return", updatedAt: new Date().toISOString() });

      await onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <button type="button" onClick={onCancel} className="back-link">
        ← Choose a different invoice
      </button>
      <h3>
        {invoice.invoiceNumber} — {customerName}
      </h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Sold</th>
            <th>Remaining</th>
            <th>Return qty</th>
          </tr>
        </thead>
        <tbody>
          {remainingByLine.map(({ line, remaining }) => (
            <tr key={line.id}>
              <td>{variantLabel(line.productVariantId)}</td>
              <td>{line.quantity}</td>
              <td>{remaining}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  max={remaining}
                  step="1"
                  disabled={remaining <= 0}
                  value={quantities[line.id] ?? ""}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <label>
        Resolution
        <select value={resolution} onChange={(e) => setResolution(e.target.value as ReturnResolution)}>
          <option value="cash_refund">Cash refund</option>
          <option value="store_credit" disabled={invoice.customerId === null}>
            Store credit (credit note)
          </option>
        </select>
      </label>
      <label>
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Processing…" : "Process return"}
      </button>
    </form>
  );
}
