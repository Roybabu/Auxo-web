import { useEffect, useState } from "react";
import { newCustomer, type Customer } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

interface CustomersScreenProps {
  canEdit: boolean;
}

export default function CustomersScreen({ canEdit }: CustomersScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setCustomers(await getRepositories().customers.list());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) return <p className="muted">Loading customers…</p>;

  return (
    <div className="customers-screen">
      <section>
        <h2>Customers</h2>
        <ul className="customer-list">
          {customers.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.phone && <span className="muted"> · {c.phone}</span>}
              {c.creditLimit != null && <span className="muted"> · Credit limit ₹{c.creditLimit}</span>}
            </li>
          ))}
          {customers.length === 0 && <li className="muted">No customers yet.</li>}
        </ul>
        {canEdit && <AddCustomerForm onAdded={refresh} />}
      </section>
    </div>
  );
}

function AddCustomerForm({ onAdded }: { onAdded: () => void | Promise<void> }) {
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
