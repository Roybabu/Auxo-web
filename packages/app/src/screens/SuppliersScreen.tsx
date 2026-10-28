import { useEffect, useMemo, useState } from "react";
import { newSupplier, type Supplier } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

interface SuppliersScreenProps {
  canEdit: boolean;
}

export default function SuppliersScreen({ canEdit }: SuppliersScreenProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setSuppliers(await getRepositories().suppliers.list());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.phone ?? "").toLowerCase().includes(term) ||
        (s.gstin ?? "").toLowerCase().includes(term)
    );
  }, [search, suppliers]);

  if (loading) return <p className="muted">Loading suppliers…</p>;

  return (
    <div className="suppliers-screen">
      <section>
        <h2>Suppliers</h2>
        <div className="table-toolbar">
          <input
            placeholder="Search by name, phone, or GSTIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>GSTIN</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td className="muted">{s.phone || "—"}</td>
                <td className="muted">{s.email || "—"}</td>
                <td className="muted">{s.gstin || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No suppliers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canEdit && <AddSupplierForm onAdded={refresh} />}
      </section>
    </div>
  );
}

function AddSupplierForm({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supplier = newSupplier({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        gstin: gstin || null,
      });
      await getRepositories().suppliers.save(supplier);
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setGstin("");
      await onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-product-form">
      <h3>Add supplier</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Phone (optional)
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Email (optional)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Address (optional)
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <label>
        GSTIN (optional)
        <input value={gstin} onChange={(e) => setGstin(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add supplier"}
      </button>
    </form>
  );
}
