import { useEffect, useMemo, useState } from "react";
import {
  newCategory,
  newProduct,
  newProductVariant,
  newStockMovement,
  stockByVariant,
  type Category,
  type Employee,
  type Product,
  type ProductVariant,
  type StockMovement,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { logActivity } from "../db/activityLog.js";

interface ProductsScreenProps {
  canEdit: boolean;
  currentEmployee: Employee;
}

/** Product catalog management: categories and products/variants with search and filters. */
export default function ProductsScreen({ canEdit, currentEmployee }: ProductsScreenProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
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

  async function toggleCategory(category: Category) {
    const repos = getRepositories();
    await repos.categories.save({ ...category, enabled: !category.enabled, updatedAt: new Date().toISOString() });
    await refresh();
  }

  const stock = useMemo(() => stockByVariant(movements), [movements]);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (!term) return true;
      const ownVariants = variants.filter((v) => v.productId === p.id);
      return (
        p.name.toLowerCase().includes(term) ||
        ownVariants.some((v) => (v.sku ?? "").toLowerCase().includes(term) || (v.barcode ?? "").toLowerCase().includes(term))
      );
    });
  }, [search, categoryFilter, products, variants]);

  if (loading) return <p className="muted">Loading products…</p>;

  return (
    <div className="inventory-screen">
      <section>
        <h2>Categories</h2>
        <p className="muted">New categories start unticked — tick the ones this shop actually sells.</p>
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  disabled={!canEdit}
                  onChange={() => void toggleCategory(c)}
                />
                {c.name}
              </label>
            </li>
          ))}
          {categories.length === 0 && <li className="muted">No categories yet.</li>}
        </ul>
        {canEdit && <AddCategoryForm onAdded={refresh} />}
      </section>

      <section>
        <h2>Products</h2>
        <div className="table-toolbar">
          <input
            placeholder="Search by name, SKU, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Tax</th>
              <th>SKU / Barcode</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) =>
              variants
                .filter((v) => v.productId === product.id)
                .map((variant, i, arr) => (
                  <tr key={variant.id}>
                    {i === 0 && (
                      <td rowSpan={arr.length}>
                        <strong>{product.name}</strong>
                      </td>
                    )}
                    {i === 0 && <td rowSpan={arr.length}>{categoryName(product.categoryId)}</td>}
                    {i === 0 && (
                      <td rowSpan={arr.length}>{product.taxRatePercent !== null ? `${product.taxRatePercent}%` : "—"}</td>
                    )}
                    <td className="muted">{variant.sku || variant.barcode || variant.name}</td>
                    <td>₹{variant.sellingPrice}</td>
                    <td>{stock.get(variant.id) ?? 0}</td>
                  </tr>
                ))
            )}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canEdit && (
          <AddProductForm categories={categories} currentEmployee={currentEmployee} onAdded={refresh} />
        )}
      </section>
    </div>
  );
}

function AddCategoryForm({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const category = newCategory(name);
      await getRepositories().categories.save(category);
      setName("");
      await onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="inline-form">
      <input
        placeholder="New category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit">Add category</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function AddProductForm({
  categories,
  currentEmployee,
  onAdded,
}: {
  categories: Category[];
  currentEmployee: Employee;
  onAdded: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [taxRatePercent, setTaxRatePercent] = useState("");
  const [variantName, setVariantName] = useState("Default");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const product = newProduct({
        categoryId: categoryId || null,
        name,
        taxRatePercent: taxRatePercent.trim() === "" ? null : Number(taxRatePercent),
      });
      await repos.products.save(product);

      const variant = newProductVariant({
        productId: product.id,
        name: variantName,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
      });
      await repos.productVariants.save(variant);

      const initialQty = Number(initialStock);
      if (initialQty !== 0) {
        const movement = newStockMovement({
          productVariantId: variant.id,
          quantityDelta: initialQty,
          reason: "initial_stock",
        });
        await repos.stockMovements.save(movement);
      }

      setName("");
      setCategoryId("");
      setTaxRatePercent("");
      setVariantName("Default");
      setSku("");
      setBarcode("");
      setMrp("");
      setSellingPrice("");
      setInitialStock("0");
      await onAdded();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "product.created",
        summary: `Added product "${product.name}" (${variant.name})`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-product-form">
      <h3>Add product</h3>
      <label>
        Product name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Category
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tax rate % (optional)
        <input value={taxRatePercent} onChange={(e) => setTaxRatePercent(e.target.value)} />
      </label>
      <label>
        Variant name
        <input value={variantName} onChange={(e) => setVariantName(e.target.value)} required />
      </label>
      <label>
        SKU (optional)
        <input value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>
      <label>
        Barcode (optional)
        <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </label>
      <label>
        MRP
        <input type="number" min="0" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} required />
      </label>
      <label>
        Selling price
        <input
          type="number"
          min="0"
          step="0.01"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          required
        />
      </label>
      <label>
        Initial stock
        <input type="number" step="1" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add product"}
      </button>
    </form>
  );
}
