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
import { getTaxSettings } from "../db/taxSettings.js";
import ProductThumb from "../components/ProductThumb.js";

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
                        <div className="product-cell">
                          <ProductThumb name={product.name} categoryName={categoryName(product.categoryId)} size={32} />
                          <strong>{product.name}</strong>
                        </div>
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

interface DraftVariant {
  key: string;
  name: string;
  sku: string;
  barcode: string;
  mrp: string;
  sellingPrice: string;
  initialStock: string;
}

let draftVariantCounter = 0;
function newDraftVariant(name = ""): DraftVariant {
  draftVariantCounter += 1;
  return { key: `draft-${draftVariantCounter}`, name, sku: "", barcode: "", mrp: "", sellingPrice: "", initialStock: "0" };
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
  const [variantRows, setVariantRows] = useState<DraftVariant[]>([newDraftVariant("Default")]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getTaxSettings().then((s) => {
      if (s.defaultTaxRatePercent != null) setTaxRatePercent(String(s.defaultTaxRatePercent));
    });
  }, []);

  function updateRow(key: string, field: keyof DraftVariant, value: string) {
    setVariantRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setVariantRows((prev) => [...prev, newDraftVariant()]);
  }

  function removeRow(key: string) {
    setVariantRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const row of variantRows) {
      if (!row.name.trim()) {
        setError("Every variant needs a name (e.g. a size or color).");
        return;
      }
      if (row.mrp.trim() === "" || row.sellingPrice.trim() === "") {
        setError(`"${row.name}": MRP and selling price are required.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const repos = getRepositories();
      const product = newProduct({
        categoryId: categoryId || null,
        name,
        taxRatePercent: taxRatePercent.trim() === "" ? null : Number(taxRatePercent),
      });
      await repos.products.save(product);

      for (const row of variantRows) {
        const variant = newProductVariant({
          productId: product.id,
          name: row.name,
          sku: row.sku.trim() || null,
          barcode: row.barcode.trim() || null,
          mrp: Number(row.mrp),
          sellingPrice: Number(row.sellingPrice),
        });
        await repos.productVariants.save(variant);

        const initialQty = Number(row.initialStock);
        if (initialQty !== 0) {
          const movement = newStockMovement({
            productVariantId: variant.id,
            quantityDelta: initialQty,
            reason: "initial_stock",
          });
          await repos.stockMovements.save(movement);
        }
      }

      setName("");
      setCategoryId("");
      setTaxRatePercent("");
      setVariantRows([newDraftVariant("Default")]);
      await onAdded();
      void logActivity({
        employeeId: currentEmployee.id,
        action: "product.created",
        summary: `Added product "${product.name}" with ${variantRows.length} variant${variantRows.length === 1 ? "" : "s"}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-product-form product-form-wide">
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

      <h4>Variants (e.g. size, color)</h4>
      <div className="table-scroll">
      <table className="variant-matrix">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Barcode</th>
            <th>MRP</th>
            <th>Selling price</th>
            <th>Initial stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {variantRows.map((row) => (
            <tr key={row.key}>
              <td>
                <input
                  placeholder="e.g. M / Blue"
                  value={row.name}
                  onChange={(e) => updateRow(row.key, "name", e.target.value)}
                />
              </td>
              <td>
                <input value={row.sku} onChange={(e) => updateRow(row.key, "sku", e.target.value)} />
              </td>
              <td>
                <input value={row.barcode} onChange={(e) => updateRow(row.key, "barcode", e.target.value)} />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.mrp}
                  onChange={(e) => updateRow(row.key, "mrp", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.sellingPrice}
                  onChange={(e) => updateRow(row.key, "sellingPrice", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="1"
                  value={row.initialStock}
                  onChange={(e) => updateRow(row.key, "initialStock", e.target.value)}
                />
              </td>
              <td>
                <button type="button" onClick={() => removeRow(row.key)} disabled={variantRows.length === 1}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button type="button" onClick={addRow} className="add-variant-row-button">
        + Add Variant
      </button>

      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add product"}
      </button>
    </form>
  );
}
