import { useEffect, useMemo, useState } from "react";
import {
  invoiceTotal,
  salesSummary,
  stockByVariant,
  type Customer,
  type Invoice,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

/** No per-variant threshold is modeled yet — this is a simple, documented heuristic, not a configured setting. */
const LOW_STOCK_HEURISTIC_THRESHOLD = 5;

export default function DashboardScreen({ canViewFinancials }: { canViewFinancials: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
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

  const todayCompleted = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return invoices.filter((i) => i.status === "completed" && new Date(i.createdAt) >= start);
  }, [invoices]);

  const summary = useMemo(() => salesSummary(todayCompleted), [todayCompleted]);
  const itemsSoldToday = useMemo(
    () => todayCompleted.reduce((sum, inv) => sum + inv.lines.reduce((s, l) => s + l.quantity, 0), 0),
    [todayCompleted]
  );

  const stock = useMemo(() => stockByVariant(movements), [movements]);
  const lowStock = useMemo(
    () => variants.filter((v) => (stock.get(v.id) ?? 0) <= LOW_STOCK_HEURISTIC_THRESHOLD),
    [variants, stock]
  );

  const recent = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "completed")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [invoices]
  );

  function productName(variantId: string): string {
    const v = variants.find((x) => x.id === variantId);
    if (!v) return "Unknown item";
    const p = products.find((x) => x.id === v.productId);
    return p ? `${p.name} — ${v.name}` : v.name;
  }

  function customerName(id: string | null): string {
    if (!id) return "Walk-in";
    return customers.find((c) => c.id === id)?.name ?? "Unknown";
  }

  if (loading) return <p className="muted">Loading dashboard…</p>;

  return (
    <div className="dashboard-screen">
      {invoices.length === 0 && customers.length === 0 && products.length === 0 ? (
        <div className="empty-state">
          <h2>Welcome to Auxo</h2>
          <p className="muted">
            Nothing here yet — add products in Inventory, then start billing from POS, and this page fills in
            with real numbers.
          </p>
        </div>
      ) : (
        <>
          {canViewFinancials && (
            <div className="report-cards">
              <div className="report-card">
                <span className="muted">Today's sales</span>
                <strong>₹{summary.totalSales.toFixed(2)}</strong>
              </div>
              <div className="report-card">
                <span className="muted">Invoices today</span>
                <strong>{summary.invoiceCount}</strong>
              </div>
              <div className="report-card">
                <span className="muted">Items sold today</span>
                <strong>{itemsSoldToday}</strong>
              </div>
              <div className="report-card">
                <span className="muted">Low stock items</span>
                <strong>{lowStock.length}</strong>
              </div>
            </div>
          )}

          <div className="dashboard-columns">
            <section>
              <h2>Recent transactions</h2>
              {recent.length === 0 ? (
                <p className="muted">No completed sales yet.</p>
              ) : (
                <ul className="rank-list">
                  {recent.map((inv) => (
                    <li key={inv.id}>
                      <span>
                        {inv.invoiceNumber} · {customerName(inv.customerId)}
                      </span>
                      <span className="muted">₹{invoiceTotal({ lines: inv.lines }).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2>Low stock</h2>
              {lowStock.length === 0 ? (
                <p className="muted">Nothing low on stock right now.</p>
              ) : (
                <ul className="rank-list">
                  {lowStock.slice(0, 8).map((v) => (
                    <li key={v.id}>
                      <span>{productName(v.id)}</span>
                      <span className="muted">{stock.get(v.id) ?? 0} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
