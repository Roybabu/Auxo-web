import { useEffect, useMemo, useState } from "react";
import {
  newStockMovement,
  stockByVariant,
  type Category,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

interface InventoryScreenProps {
  canEdit: boolean;
}

const LOW_STOCK_THRESHOLD = 5;

/** Stock-focused view: summary counts, current levels with quick adjustments, and movement history. */
export default function InventoryScreen({ canEdit }: InventoryScreenProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const repos = getRepositories();
    const [cats, prods, vars, moves] = await Promise.all([
      repos.categories.list(),
      repos.products.list(),
      repos.productVariants.list(),
      repos.stockMovements.list(),
    ]);
    setCategories(cats);
    setProducts(prods);
    setVariants(vars);
    setMovements(moves);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const stock = useMemo(() => stockByVariant(movements), [movements]);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Unknown product";
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const { lowStock, outOfStock, totalValue } = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const variant of variants) {
      const qty = stock.get(variant.id) ?? 0;
      if (qty <= 0) out += 1;
      else if (qty <= LOW_STOCK_THRESHOLD) low += 1;
      value += qty * variant.sellingPrice;
    }
    return { lowStock: low, outOfStock: out, totalValue: value };
  }, [variants, stock]);

  const filteredVariants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return variants;
    return variants.filter((v) => {
      const product = products.find((p) => p.id === v.productId);
      return (
        (product?.name.toLowerCase().includes(term) ?? false) ||
        v.name.toLowerCase().includes(term) ||
        (v.sku ?? "").toLowerCase().includes(term) ||
        (v.barcode ?? "").toLowerCase().includes(term)
      );
    });
  }, [search, variants, products]);

  const recentMovements = useMemo(
    () =>
      [...movements]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20),
    [movements]
  );

  async function adjustStock(variant: ProductVariant, delta: number) {
    const repos = getRepositories();
    const movement = newStockMovement({
      productVariantId: variant.id,
      quantityDelta: delta,
      reason: "manual_adjustment",
    });
    await repos.stockMovements.save(movement);
    await refresh();
  }

  if (loading) return <p className="muted">Loading inventory…</p>;

  return (
    <div className="inventory-screen">
      <section>
        <div className="report-cards">
          <div className="report-card">
            <span className="muted">Stock value</span>
            <strong>₹{totalValue.toFixed(2)}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Low stock (≤ {LOW_STOCK_THRESHOLD})</span>
            <strong>{lowStock}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Out of stock</span>
            <strong>{outOfStock}</strong>
          </div>
        </div>
      </section>

      <section>
        <h2>Current stock</h2>
        <div className="table-toolbar">
          <input
            placeholder="Search by product, SKU, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Category</th>
              <th>Stock</th>
              {canEdit && <th>Adjust</th>}
            </tr>
          </thead>
          <tbody>
            {filteredVariants.map((variant) => {
              const qty = stock.get(variant.id) ?? 0;
              const product = products.find((p) => p.id === variant.productId);
              const badge = qty <= 0 ? "out" : qty <= LOW_STOCK_THRESHOLD ? "low" : "ok";
              return (
                <tr key={variant.id}>
                  <td>{productName(variant.productId)}</td>
                  <td className="muted">{variant.name}</td>
                  <td>{categoryName(product?.categoryId ?? null)}</td>
                  <td>
                    <span className={`pos-stock-badge ${badge}`}>{qty}</span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="stock-buttons">
                        <button type="button" onClick={() => void adjustStock(variant, -1)}>
                          −1
                        </button>
                        <button type="button" onClick={() => void adjustStock(variant, 1)}>
                          +1
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredVariants.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="muted">
                  No stock items match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Recent stock movements</h2>
        <ul className="movement-list">
          {recentMovements.map((m) => {
            const variant = variants.find((v) => v.id === m.productVariantId);
            return (
              <li key={m.id}>
                <span>{variant ? `${productName(variant.productId)} — ${variant.name}` : "Unknown item"}</span>
                <span className={m.quantityDelta >= 0 ? "success" : "error"}>
                  {m.quantityDelta >= 0 ? "+" : ""}
                  {m.quantityDelta}
                </span>
                <span className="muted">{m.reason}</span>
                <span className="muted">{new Date(m.createdAt).toLocaleString()}</span>
              </li>
            );
          })}
          {recentMovements.length === 0 && <li className="muted">No stock movements yet.</li>}
        </ul>
      </section>
    </div>
  );
}
