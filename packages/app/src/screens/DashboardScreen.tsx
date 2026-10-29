import { useEffect, useMemo, useState } from "react";
import {
  invoiceTotal,
  salesSummary,
  stockByVariant,
  topProductsByQuantity,
  type Category,
  type Customer,
  type Invoice,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { PlusCircle, Package, UserPlus, ShoppingBag, BarChart3 } from "lucide-react";
import { getRepositories } from "../db/repositories.js";
import { MiniBarChart, MiniDonut } from "../components/charts.js";

/** No per-variant threshold is modeled yet — this is a simple, documented heuristic, not a configured setting. */
const LOW_STOCK_HEURISTIC_THRESHOLD = 5;

interface DashboardScreenProps {
  canViewFinancials: boolean;
  canBill: boolean;
  canEditInventory: boolean;
  canEditCustomers: boolean;
  canEditPurchases: boolean;
  canViewReports: boolean;
  onNavigate: (section: string) => void;
}

export default function DashboardScreen({
  canViewFinancials,
  canBill,
  canEditInventory,
  canEditCustomers,
  canEditPurchases,
  canViewReports,
  onNavigate,
}: DashboardScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const repos = getRepositories();
      const [invs, custs, vars, prods, cats, moves] = await Promise.all([
        repos.invoices.list(),
        repos.customers.list(),
        repos.productVariants.list(),
        repos.products.list(),
        repos.categories.list(),
        repos.stockMovements.list(),
      ]);
      setInvoices(invs);
      setCustomers(custs);
      setVariants(vars);
      setProducts(prods);
      setCategories(cats);
      setMovements(moves);
      setLoading(false);
    })();
  }, []);

  const todayCompleted = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return invoices.filter((i) => i.status === "completed" && new Date(i.createdAt) >= start);
  }, [invoices]);

  const allCompleted = useMemo(() => invoices.filter((i) => i.status === "completed"), [invoices]);

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
    () => [...allCompleted].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [allCompleted]
  );

  const salesTrend = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const total = allCompleted
        .filter((inv) => {
          const t = new Date(inv.createdAt);
          return t >= day && t < next;
        })
        .reduce((sum, inv) => sum + invoiceTotal({ lines: inv.lines }), 0);
      days.push({ label: day.toLocaleDateString(undefined, { weekday: "short" }), value: total });
    }
    return days;
  }, [allCompleted]);

  const topProducts = useMemo(() => topProductsByQuantity(allCompleted, 5), [allCompleted]);

  function variantLabel(variantId: string): string {
    const v = variants.find((x) => x.id === variantId);
    if (!v) return "Unknown item";
    const p = products.find((x) => x.id === v.productId);
    return p ? `${p.name} — ${v.name}` : v.name;
  }

  const categorySales = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const invoice of allCompleted) {
      for (const line of invoice.lines) {
        const variant = variants.find((v) => v.id === line.productVariantId);
        const product = variant ? products.find((p) => p.id === variant.productId) : undefined;
        const category = product?.categoryId ? categories.find((c) => c.id === product.categoryId) : null;
        const name = category?.name ?? "Uncategorized";
        byCategory.set(name, (byCategory.get(name) ?? 0) + line.quantity * line.unitPrice);
      }
    }
    return Array.from(byCategory.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [allCompleted, variants, products, categories]);

  function customerName(id: string | null): string {
    if (!id) return "Walk-in";
    return customers.find((c) => c.id === id)?.name ?? "Unknown";
  }

  if (loading) return <p className="muted">Loading dashboard…</p>;

  const isEmpty = invoices.length === 0 && customers.length === 0 && products.length === 0;

  return (
    <div className="dashboard-screen">
      <div className="quick-actions">
        {canBill && (
          <button type="button" className="quick-action-button" onClick={() => onNavigate("pos")}>
            <PlusCircle size={18} /> New Sale
          </button>
        )}
        {canEditInventory && (
          <button type="button" className="quick-action-button" onClick={() => onNavigate("products")}>
            <Package size={18} /> Add Product
          </button>
        )}
        {canEditCustomers && (
          <button type="button" className="quick-action-button" onClick={() => onNavigate("customers")}>
            <UserPlus size={18} /> Add Customer
          </button>
        )}
        {canEditPurchases && (
          <button type="button" className="quick-action-button" onClick={() => onNavigate("purchases")}>
            <ShoppingBag size={18} /> Create Purchase
          </button>
        )}
        {canViewReports && (
          <button type="button" className="quick-action-button" onClick={() => onNavigate("reports")}>
            <BarChart3 size={18} /> View Reports
          </button>
        )}
      </div>

      {isEmpty ? (
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

          {canViewFinancials && (
            <div className="dashboard-columns">
              <section>
                <h2>Sales trend (last 7 days)</h2>
                <MiniBarChart points={salesTrend} />
              </section>
              <section>
                <h2>Category-wise sales</h2>
                <MiniDonut slices={categorySales} />
              </section>
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

            {canViewFinancials && (
              <section>
                <h2>Top products</h2>
                {topProducts.length === 0 ? (
                  <p className="muted">No sales yet.</p>
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
            )}

            <section>
              <h2>Low stock</h2>
              {lowStock.length === 0 ? (
                <p className="muted">Nothing low on stock right now.</p>
              ) : (
                <ul className="rank-list">
                  {lowStock.slice(0, 8).map((v) => (
                    <li key={v.id}>
                      <span>{variantLabel(v.id)}</span>
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
