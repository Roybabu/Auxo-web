import { useEffect, useMemo, useState } from "react";
import {
  cancelPurchase,
  markPurchaseReceived,
  newPurchase,
  newPurchaseLine,
  newStockMovement,
  purchaseTotal,
  type Employee,
  type Product,
  type ProductVariant,
  type Purchase,
  type PurchaseLine,
  type Supplier,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { allocateNextPurchaseNumber } from "../db/purchaseSequence.js";
import { logActivity } from "../db/activityLog.js";

interface PurchasesScreenProps {
  canEdit: boolean;
  currentEmployee: Employee;
}

export default function PurchasesScreen({ canEdit, currentEmployee }: PurchasesScreenProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function refresh() {
    const repos = getRepositories();
    const [purs, sups, vars, prods] = await Promise.all([
      repos.purchases.list(),
      repos.suppliers.list(),
      repos.productVariants.list(),
      repos.products.list(),
    ]);
    setPurchases(purs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setSuppliers(sups);
    setVariants(vars);
    setProducts(prods);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "Unknown supplier";

  async function receiveGoods(purchase: Purchase) {
    setActionError(null);
    setBusyId(purchase.id);
    try {
      const repos = getRepositories();
      for (const line of purchase.lines) {
        const movement = newStockMovement({
          productVariantId: line.productVariantId,
          quantityDelta: line.quantity,
          reason: "purchase",
          referenceId: purchase.id,
        });
        await repos.stockMovements.save(movement);
      }
      await repos.purchases.save(markPurchaseReceived(purchase));
      await refresh();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "purchase.received",
        summary: `Received goods for purchase ${purchase.purchaseNumber}`,
        metadata: { purchaseNumber: purchase.purchaseNumber },
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(purchase: Purchase) {
    setActionError(null);
    setBusyId(purchase.id);
    try {
      await getRepositories().purchases.save(cancelPurchase(purchase));
      await refresh();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "purchase.cancelled",
        summary: `Cancelled purchase ${purchase.purchaseNumber}`,
        metadata: { purchaseNumber: purchase.purchaseNumber },
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Loading purchases…</p>;

  return (
    <div className="purchases-screen">
      <section>
        <h2>Purchases</h2>
        {actionError && <p className="error">{actionError}</p>}
        <table className="data-table">
          <thead>
            <tr>
              <th>Purchase</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.purchaseNumber}</td>
                <td>{supplierName(p.supplierId)}</td>
                <td className="muted">{new Date(p.createdAt).toLocaleString()}</td>
                <td>₹{purchaseTotal({ lines: p.lines }).toFixed(2)}</td>
                <td>
                  <span className={`status-badge status-${p.status === "received" ? "completed" : p.status === "cancelled" ? "voided" : "held"}`}>
                    {p.status}
                  </span>
                </td>
                {canEdit && (
                  <td>
                    {p.status === "draft" && (
                      <div className="row-actions">
                        <button type="button" disabled={busyId === p.id} onClick={() => void receiveGoods(p)}>
                          Receive goods
                        </button>
                        <button type="button" disabled={busyId === p.id} onClick={() => void cancel(p)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="muted">
                  No purchases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {canEdit && (
        <NewPurchaseForm
          suppliers={suppliers}
          variants={variants}
          products={products}
          currentEmployee={currentEmployee}
          onCreated={refresh}
        />
      )}
    </div>
  );
}

function NewPurchaseForm({
  suppliers,
  variants,
  products,
  currentEmployee,
  onCreated,
}: {
  suppliers: Supplier[];
  variants: ProductVariant[];
  products: Product[];
  currentEmployee: Employee;
  onCreated: () => void | Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [lineVariantId, setLineVariantId] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitCost, setLineUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const variantLabel = (id: string) => {
    const variant = variants.find((v) => v.id === id);
    if (!variant) return "Unknown item";
    const product = products.find((p) => p.id === variant.productId);
    return product ? `${product.name} — ${variant.name}` : variant.name;
  };

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0), [lines]);

  function addLine(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const line = newPurchaseLine({
        productVariantId: lineVariantId,
        quantity: Number(lineQuantity),
        unitCost: Number(lineUnitCost),
      });
      setLines((prev) => [...prev, line]);
      setLineVariantId("");
      setLineQuantity("1");
      setLineUnitCost("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError("Choose a supplier.");
      return;
    }
    if (lines.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const purchaseNumber = await allocateNextPurchaseNumber();
      const purchase = newPurchase({
        purchaseNumber,
        supplierId,
        employeeId: currentEmployee.id,
        lines,
        note: note || null,
      });
      await repos.purchases.save(purchase);
      setSupplierId("");
      setLines([]);
      setNote("");
      await onCreated();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "purchase.created",
        summary: `Created purchase ${purchase.purchaseNumber} for ₹${purchaseTotal({ lines: purchase.lines }).toFixed(2)}`,
        metadata: { purchaseNumber: purchase.purchaseNumber },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>New purchase</h2>
      <form onSubmit={handleSubmit} className="add-product-form">
        <label>
          Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Choose a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </form>

      <div className="inline-form">
        <select value={lineVariantId} onChange={(e) => setLineVariantId(e.target.value)}>
          <option value="">Choose an item…</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {variantLabel(v.id)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Qty"
          value={lineQuantity}
          onChange={(e) => setLineQuantity(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Unit cost"
          value={lineUnitCost}
          onChange={(e) => setLineUnitCost(e.target.value)}
        />
        <button type="button" onClick={addLine} disabled={!lineVariantId}>
          Add line
        </button>
      </div>

      {lines.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Line total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{variantLabel(l.productVariantId)}</td>
                <td>{l.quantity}</td>
                <td>₹{l.unitCost.toFixed(2)}</td>
                <td>₹{(l.quantity * l.unitCost).toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => removeLine(l.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lines.length > 0 && (
        <p>
          <strong>Total: ₹{total.toFixed(2)}</strong>
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <button type="button" onClick={(e) => void handleSubmit(e)} disabled={submitting}>
        {submitting ? "Creating…" : "Create purchase"}
      </button>
    </section>
  );
}
