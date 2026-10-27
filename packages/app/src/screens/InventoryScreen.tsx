import { useEffect, useState } from "react";
import {
  newCategory,
  newProduct,
  newProductVariant,
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

export default function InventoryScreen({ canEdit }: InventoryScreenProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
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

  const stock = stockByVariant(movements);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

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
        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id} className="product-row">
              <div className="product-row-header">
                <strong>{product.name}</strong>
                <span className="muted">
                  {categoryName(product.categoryId)}
                  {product.taxRatePercent !== null ? ` · ${product.taxRatePercent}% tax` : ""}
                </span>
              </div>
              <ul className="variant-list">
                {variants
                  .filter((v) => v.productId === product.id)
                  .map((variant) => (
                    <li key={variant.id} className="variant-row">
                      <span>{variant.name}</span>
                      <span className="muted">MRP ₹{variant.mrp} · Sells ₹{variant.sellingPrice}</span>
                      <span>Stock: {stock.get(variant.id) ?? 0}</span>
                      {canEdit && (
                        <span className="stock-buttons">
                          <button type="button" onClick={() => void adjustStock(variant, 1)}>
                            +1
                          </button>
                          <button type="button" onClick={() => void adjustStock(variant, -1)}>
                            −1
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
          {products.length === 0 && <li className="muted">No products yet.</li>}
        </ul>
        {canEdit && <AddProductForm categories={categories} onAdded={refresh} />}
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
  onAdded,
}: {
  categories: Category[];
  onAdded: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [taxRatePercent, setTaxRatePercent] = useState("");
  const [variantName, setVariantName] = useState("Default");
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
        sku: null,
        barcode: null,
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
      setMrp("");
      setSellingPrice("");
      setInitialStock("0");
      await onAdded();
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
