import { useEffect, useMemo, useState } from "react";
import {
  businessDateFor,
  newDayClosing,
  returnTotal,
  type DayClosing,
  type Employee,
  type Invoice,
  type Return,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

interface DayClosingScreenProps {
  canEdit: boolean;
  currentEmployee: Employee;
}

export default function DayClosingScreen({ canEdit, currentEmployee }: DayClosingScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [closings, setClosings] = useState<DayClosing[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const repos = getRepositories();
    const [invs, rets, close, emps] = await Promise.all([
      repos.invoices.list(),
      repos.returns.list(),
      repos.dayClosings.list(),
      repos.employees.list(),
    ]);
    setInvoices(invs);
    setReturns(rets);
    setClosings(close.sort((a, b) => b.businessDate.localeCompare(a.businessDate)));
    setEmployees(emps);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const today = businessDateFor(new Date());
  const todaysClosing = closings.find((c) => c.businessDate === today) ?? null;
  const employeeName = (id: string | null) => (id ? employees.find((e) => e.id === id)?.name ?? "Unknown" : "—");

  if (loading) return <p className="muted">Loading day closing…</p>;

  return (
    <div className="day-closing-screen">
      <section>
        <h2>Day closing — {today}</h2>
        {todaysClosing ? (
          <ClosedSummary closing={todaysClosing} employeeName={employeeName(todaysClosing.employeeId)} />
        ) : canEdit ? (
          <CloseForm
            today={today}
            invoices={invoices}
            returns={returns}
            previousClosing={closings[0] ?? null}
            currentEmployee={currentEmployee}
            onClosed={refresh}
          />
        ) : (
          <p className="muted">Today hasn't been closed yet.</p>
        )}
      </section>

      <section>
        <h2>Closing history</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Opening</th>
              <th>Collected</th>
              <th>Refunded</th>
              <th>Expected</th>
              <th>Counted</th>
              <th>Variance</th>
              <th>Closed by</th>
            </tr>
          </thead>
          <tbody>
            {closings.map((c) => (
              <tr key={c.id}>
                <td>{c.businessDate}</td>
                <td>₹{c.openingCash.toFixed(2)}</td>
                <td>₹{c.collectedCash.toFixed(2)}</td>
                <td>₹{c.refundedCash.toFixed(2)}</td>
                <td>₹{c.expectedCash.toFixed(2)}</td>
                <td>₹{c.countedCash.toFixed(2)}</td>
                <td className={c.variance === 0 ? "" : c.variance > 0 ? "success" : "error"}>
                  {c.variance > 0 ? "+" : ""}
                  {c.variance.toFixed(2)}
                </td>
                <td className="muted">{employeeName(c.employeeId)}</td>
              </tr>
            ))}
            {closings.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No day closings recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ClosedSummary({ closing, employeeName }: { closing: DayClosing; employeeName: string }) {
  return (
    <div className="report-cards">
      <div className="report-card">
        <span className="muted">Expected cash</span>
        <strong>₹{closing.expectedCash.toFixed(2)}</strong>
      </div>
      <div className="report-card">
        <span className="muted">Counted cash</span>
        <strong>₹{closing.countedCash.toFixed(2)}</strong>
      </div>
      <div className="report-card">
        <span className="muted">Variance</span>
        <strong className={closing.variance === 0 ? "" : closing.variance > 0 ? "success" : "error"}>
          {closing.variance > 0 ? "+" : ""}
          {closing.variance.toFixed(2)}
        </strong>
      </div>
      <div className="report-card">
        <span className="muted">Closed by</span>
        <strong>{employeeName}</strong>
      </div>
    </div>
  );
}

function CloseForm({
  today,
  invoices,
  returns,
  previousClosing,
  currentEmployee,
  onClosed,
}: {
  today: string;
  invoices: Invoice[];
  returns: Return[];
  previousClosing: DayClosing | null;
  currentEmployee: Employee;
  onClosed: () => void | Promise<void>;
}) {
  const [openingCash, setOpeningCash] = useState(String(previousClosing?.countedCash ?? 0));
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const collectedCash = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "completed" && businessDateFor(new Date(i.createdAt)) === today)
        .reduce((sum, i) => sum + i.amountPaid, 0),
    [invoices, today]
  );

  const refundedCash = useMemo(
    () =>
      returns
        .filter((r) => r.resolution === "cash_refund" && businessDateFor(new Date(r.createdAt)) === today)
        .reduce((sum, r) => sum + returnTotal({ lines: r.lines }), 0),
    [returns, today]
  );

  const opening = Number(openingCash) || 0;
  const expectedCash = opening + collectedCash - refundedCash;
  const counted = Number(countedCash) || 0;
  const variance = countedCash.trim() === "" ? null : counted - expectedCash;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (countedCash.trim() === "") {
      setError("Enter the counted cash before closing the day.");
      return;
    }
    setSubmitting(true);
    try {
      const closing = newDayClosing({
        businessDate: today,
        openingCash: opening,
        collectedCash,
        refundedCash,
        countedCash: counted,
        employeeId: currentEmployee.id,
        note: note || null,
      });
      await getRepositories().dayClosings.save(closing);
      await onClosed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="add-product-form">
      <div className="report-cards">
        <div className="report-card">
          <span className="muted">Collected today</span>
          <strong>₹{collectedCash.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Cash refunds today</span>
          <strong>₹{refundedCash.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Expected in drawer</span>
          <strong>₹{expectedCash.toFixed(2)}</strong>
        </div>
      </div>

      <p className="muted">
        Collected and refunded figures treat every payment as cash. If you also accept card or UPI, subtract
        those amounts before comparing to what's physically in the drawer.
      </p>

      <label>
        Opening cash
        <input type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
      </label>
      <label>
        Counted cash
        <input type="number" min="0" step="0.01" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} required />
      </label>
      {variance !== null && (
        <p>
          Variance:{" "}
          <strong className={variance === 0 ? "" : variance > 0 ? "success" : "error"}>
            {variance > 0 ? "+" : ""}
            {variance.toFixed(2)}
          </strong>
        </p>
      )}
      <label>
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Closing…" : "Close the day"}
      </button>
    </form>
  );
}
