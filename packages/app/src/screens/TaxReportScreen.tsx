import { useEffect, useMemo, useState } from "react";
import { lineSubtotal, lineTax, type Business, type Invoice } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

type RangeOption = "today" | "week" | "month" | "all";

function rangeStart(option: RangeOption): Date | null {
  const now = new Date();
  if (option === "all") return null;
  if (option === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (option === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return start;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

interface TaxReportScreenProps {
  business: Business;
}

export default function TaxReportScreen({ business }: TaxReportScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [range, setRange] = useState<RangeOption>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const invs = await getRepositories().invoices.list();
      setInvoices(invs);
      setLoading(false);
    })();
  }, []);

  const completedInRange = useMemo(() => {
    const start = rangeStart(range);
    return invoices.filter((i) => {
      if (i.status !== "completed") return false;
      if (!start) return true;
      return new Date(i.createdAt) >= start;
    });
  }, [invoices, range]);

  const byRate = useMemo(() => {
    const totals = new Map<number, { taxable: number; tax: number }>();
    for (const invoice of completedInRange) {
      for (const line of invoice.lines) {
        const entry = totals.get(line.taxRatePercent) ?? { taxable: 0, tax: 0 };
        entry.taxable += lineSubtotal(line);
        entry.tax += lineTax(line);
        totals.set(line.taxRatePercent, entry);
      }
    }
    return Array.from(totals.entries())
      .map(([rate, v]) => ({ rate, ...v }))
      .sort((a, b) => a.rate - b.rate);
  }, [completedInRange]);

  const totalTaxable = byRate.reduce((sum, r) => sum + r.taxable, 0);
  const totalTax = byRate.reduce((sum, r) => sum + r.tax, 0);

  function exportCsv() {
    const header = ["Tax rate", "Taxable value", "Tax amount", "Total"];
    const rows = byRate.map((r) => [`${r.rate}%`, r.taxable.toFixed(2), r.tax.toFixed(2), (r.taxable + r.tax).toFixed(2)]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (loading) return <p className="muted">Loading tax report…</p>;

  return (
    <div className="reports-screen">
      <div className="reports-toolbar">
        <div className="range-picker">
          {(["today", "week", "month", "all"] as RangeOption[]).map((option) => (
            <button
              key={option}
              type="button"
              className={range === option ? "tab active" : "tab"}
              onClick={() => setRange(option)}
            >
              {option === "today" ? "Today" : option === "week" ? "Last 7 days" : option === "month" ? "This month" : "All time"}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportCsv} disabled={byRate.length === 0}>
          Export CSV
        </button>
      </div>

      {business.gstin && <p className="muted">GSTIN: {business.gstin}</p>}

      <div className="report-cards">
        <div className="report-card">
          <span className="muted">Taxable value</span>
          <strong>₹{totalTaxable.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Tax collected</span>
          <strong>₹{totalTax.toFixed(2)}</strong>
        </div>
        <div className="report-card">
          <span className="muted">Invoices</span>
          <strong>{completedInRange.length}</strong>
        </div>
      </div>

      <section>
        <h2>Tax by rate</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Tax rate</th>
              <th>Taxable value</th>
              <th>Tax amount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {byRate.map((r) => (
              <tr key={r.rate}>
                <td>{r.rate}%</td>
                <td>₹{r.taxable.toFixed(2)}</td>
                <td>₹{r.tax.toFixed(2)}</td>
                <td>₹{(r.taxable + r.tax).toFixed(2)}</td>
              </tr>
            ))}
            {byRate.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No sales in this range yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
