import { useEffect, useMemo, useState } from "react";
import type { ActivityLog, Employee } from "@auxo/core";
import { getRepositories } from "../db/repositories.js";

export default function ActivityLogScreen() {
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const repos = getRepositories();
      const [logs, emps] = await Promise.all([repos.activityLogs.list(), repos.employees.list()]);
      setEntries(logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setEmployees(emps);
      setLoading(false);
    })();
  }, []);

  const employeeName = (id: string | null) => (id ? employees.find((e) => e.id === id)?.name ?? "Unknown" : "System");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (e) =>
        e.summary.toLowerCase().includes(term) ||
        e.action.toLowerCase().includes(term) ||
        employeeName(e.employeeId).toLowerCase().includes(term)
    );
  }, [search, entries, employees]);

  function exportCsv() {
    const header = ["Date", "Employee", "Action", "Summary"];
    const rows = filtered.map((e) => [new Date(e.createdAt).toLocaleString(), employeeName(e.employeeId), e.action, e.summary]);
    const csvEscape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (loading) return <p className="muted">Loading activity log…</p>;

  return (
    <div className="activity-log-screen">
      <section>
        <div className="reports-toolbar">
          <h2>Activity log</h2>
          <button type="button" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
        <div className="table-toolbar">
          <input
            placeholder="Search by employee, action, or summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Action</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td>{employeeName(e.employeeId)}</td>
                <td className="muted">{e.action}</td>
                <td>{e.summary}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <p className="muted">Showing the most recent 300 of {filtered.length} entries. Export CSV for the full list.</p>
        )}
      </section>
    </div>
  );
}
