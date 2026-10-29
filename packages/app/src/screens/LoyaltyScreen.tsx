import { useEffect, useMemo, useState } from "react";
import {
  applyPointsDelta,
  redemptionValue,
  type Customer,
  type Employee,
  type LoyaltyProgramSettings,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { getLoyaltySettings } from "../db/loyaltySettings.js";
import { logActivity } from "../db/activityLog.js";

interface LoyaltyScreenProps {
  canEdit: boolean;
  currentEmployee: Employee;
}

export default function LoyaltyScreen({ canEdit, currentEmployee }: LoyaltyScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<LoyaltyProgramSettings | null>(null);
  const [search, setSearch] = useState("");
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [custs, loyaltySettings] = await Promise.all([
      getRepositories().customers.list(),
      getLoyaltySettings(),
    ]);
    setCustomers(custs);
    setSettings(loyaltySettings);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").toLowerCase().includes(term));
  }, [search, customers]);

  const totalPointsOutstanding = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const redeemingCustomer = redeemingId ? customers.find((c) => c.id === redeemingId) ?? null : null;

  if (loading || !settings) return <p className="muted">Loading loyalty program…</p>;

  return (
    <div className="loyalty-screen">
      <section>
        <h2>Loyalty program</h2>
        <p className="muted">
          {settings.enabled
            ? `Earns ${settings.pointsPerRupeeSpent} point(s) per ₹1 spent · 1 point redeems for ₹${settings.redemptionValuePerPoint.toFixed(2)}`
            : "The loyalty program is currently disabled in Settings."}
        </p>
        <div className="report-cards">
          <div className="report-card">
            <span className="muted">Customers enrolled</span>
            <strong>{customers.length}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Points outstanding</span>
            <strong>{totalPointsOutstanding}</strong>
          </div>
          <div className="report-card">
            <span className="muted">Outstanding value</span>
            <strong>₹{redemptionValue(totalPointsOutstanding, settings).toFixed(2)}</strong>
          </div>
        </div>
      </section>

      <section>
        <div className="table-toolbar">
          <input
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Points</th>
              <th>Value</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td className="muted">{c.phone || "—"}</td>
                <td>{c.loyaltyPoints}</td>
                <td>₹{redemptionValue(c.loyaltyPoints, settings).toFixed(2)}</td>
                {canEdit && (
                  <td>
                    <button type="button" disabled={c.loyaltyPoints <= 0} onClick={() => setRedeemingId(c.id)}>
                      Redeem
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="muted">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {redeemingCustomer && (
        <RedeemForm
          customer={redeemingCustomer}
          settings={settings}
          currentEmployee={currentEmployee}
          onDone={async () => {
            setRedeemingId(null);
            await refresh();
          }}
          onCancel={() => setRedeemingId(null)}
        />
      )}
    </div>
  );
}

function RedeemForm({
  customer,
  settings,
  currentEmployee,
  onDone,
  onCancel,
}: {
  customer: Customer;
  settings: LoyaltyProgramSettings;
  currentEmployee: Employee;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(points);
    if (!qty || qty <= 0) {
      setError("Enter how many points to redeem.");
      return;
    }
    if (qty > customer.loyaltyPoints) {
      setError(`${customer.name} only has ${customer.loyaltyPoints} points.`);
      return;
    }
    setSubmitting(true);
    try {
      const updated = { ...customer, loyaltyPoints: applyPointsDelta(customer.loyaltyPoints, -qty) };
      await getRepositories().customers.save(updated);
      void logActivity({
        employeeId: currentEmployee.id,
        action: "loyalty.redeemed",
        summary: `Redeemed ${qty} point(s) (₹${redemptionValue(qty, settings).toFixed(2)}) for ${customer.name}${note ? ` — ${note}` : ""}`,
      });
      await onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
        <button type="button" onClick={onCancel} className="back-link">
          ← Cancel
        </button>
        <h3>Redeem points for {customer.name}</h3>
        <p className="muted">
          Balance: {customer.loyaltyPoints} points (₹{redemptionValue(customer.loyaltyPoints, settings).toFixed(2)})
        </p>
        <label>
          Points to redeem
          <input type="number" min="1" max={customer.loyaltyPoints} value={points} onChange={(e) => setPoints(e.target.value)} />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Redeeming…" : "Redeem"}
        </button>
      </form>
    </section>
  );
}
