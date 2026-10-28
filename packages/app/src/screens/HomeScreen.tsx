import { useEffect, useState } from "react";
import {
  ALL_PERMISSIONS,
  hasPermission,
  newEmployee,
  type Business,
  type Employee,
  type Permission,
} from "@auxo/core";
import { getRepositories } from "../db/repositories.js";
import { setSession } from "../appState.js";
import BackupPanel from "./BackupPanel.js";
import AndroidImportPanel from "./AndroidImportPanel.js";
import InventoryScreen from "./InventoryScreen.js";
import BillingScreen from "./BillingScreen.js";
import CustomersScreen from "./CustomersScreen.js";
import InvoiceHistoryScreen from "./InvoiceHistoryScreen.js";
import ReportsScreen from "./ReportsScreen.js";

interface HomeScreenProps {
  business: Business;
  currentEmployee: Employee;
  onSignedOut: () => void;
  onRestored: () => void | Promise<void>;
}

type Tab = "overview" | "inventory" | "billing" | "customers" | "history" | "reports";

export default function HomeScreen({ business, currentEmployee, onSignedOut, onRestored }: HomeScreenProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const canViewInventory = hasPermission(currentEmployee, "inventory.view");
  const canEditInventory = hasPermission(currentEmployee, "inventory.edit");
  const canBill = hasPermission(currentEmployee, "billing.create");
  const canVoidBill = hasPermission(currentEmployee, "billing.void");
  const canViewCustomers = hasPermission(currentEmployee, "customers.view");
  const canEditCustomers = hasPermission(currentEmployee, "customers.edit");
  const canViewHistory = canBill || hasPermission(currentEmployee, "reports.view");
  const canViewReports = hasPermission(currentEmployee, "reports.view");

  async function signOut() {
    await setSession(null);
    onSignedOut();
  }

  return (
    <main className="home-screen">
      <header>
        <h1>{business.name}</h1>
        <div>
          <span className="muted">
            {currentEmployee.name} · {currentEmployee.role === "super_admin" ? "Super Admin" : "Employee"}
          </span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tab-bar">
        <button
          type="button"
          className={tab === "overview" ? "tab active" : "tab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        {canBill && (
          <button
            type="button"
            className={tab === "billing" ? "tab active" : "tab"}
            onClick={() => setTab("billing")}
          >
            Billing
          </button>
        )}
        {canViewInventory && (
          <button
            type="button"
            className={tab === "inventory" ? "tab active" : "tab"}
            onClick={() => setTab("inventory")}
          >
            Inventory
          </button>
        )}
        {canViewCustomers && (
          <button
            type="button"
            className={tab === "customers" ? "tab active" : "tab"}
            onClick={() => setTab("customers")}
          >
            Customers
          </button>
        )}
        {canViewHistory && (
          <button
            type="button"
            className={tab === "history" ? "tab active" : "tab"}
            onClick={() => setTab("history")}
          >
            History
          </button>
        )}
        {canViewReports && (
          <button
            type="button"
            className={tab === "reports" ? "tab active" : "tab"}
            onClick={() => setTab("reports")}
          >
            Reports
          </button>
        )}
      </nav>

      {tab === "overview" && (
        <OverviewTab currentEmployee={currentEmployee} onRestored={onRestored} />
      )}
      {tab === "billing" && canBill && (
        <BillingScreen currentEmployee={currentEmployee} canVoid={canVoidBill} />
      )}
      {tab === "inventory" && canViewInventory && <InventoryScreen canEdit={canEditInventory} />}
      {tab === "customers" && canViewCustomers && <CustomersScreen canEdit={canEditCustomers} />}
      {tab === "history" && canViewHistory && <InvoiceHistoryScreen business={business} />}
      {tab === "reports" && canViewReports && <ReportsScreen />}
    </main>
  );
}

function OverviewTab({
  currentEmployee,
  onRestored,
}: {
  currentEmployee: Employee;
  onRestored: () => void | Promise<void>;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);

  async function refreshEmployees() {
    setEmployees(await getRepositories().employees.list());
  }

  useEffect(() => {
    if (currentEmployee.role === "super_admin") void refreshEmployees();
  }, [currentEmployee.role]);

  return (
    <>

      {currentEmployee.role === "super_admin" && (
        <section>
          <h2>Employees</h2>
          <ul className="employee-list">
            {employees.map((e) => (
              <li key={e.id}>
                <strong>{e.name}</strong> (@{e.username}) — {e.role === "super_admin" ? "Super Admin" : `${e.permissions.length} permission(s)`}
                {!e.active && " · deactivated"}
              </li>
            ))}
          </ul>
          <AddEmployeeForm existing={employees} onAdded={refreshEmployees} />
        </section>
      )}

      <section>
        <h2>Backup</h2>
        <BackupPanel onRestored={onRestored} />
      </section>

      {currentEmployee.role === "super_admin" && (
        <section>
          <h2>Import from Android app</h2>
          <AndroidImportPanel />
        </section>
      )}
    </>
  );
}

function AddEmployeeForm({ existing, onAdded }: { existing: Employee[]; onAdded: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function togglePermission(permission: Permission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const employee = await newEmployee(
        { name, username, password, permissions: Array.from(permissions) },
        existing
      );
      await getRepositories().employees.save(employee);
      setName("");
      setUsername("");
      setPassword("");
      setPermissions(new Set());
      await onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-employee-form">
      <h3>Add employee</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <fieldset>
        <legend>Access (chosen individually, no presets)</legend>
        {ALL_PERMISSIONS.map((permission) => (
          <label key={permission} className="checkbox-row">
            <input
              type="checkbox"
              checked={permissions.has(permission)}
              onChange={() => togglePermission(permission)}
            />
            {permission}
          </label>
        ))}
      </fieldset>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add employee"}
      </button>
    </form>
  );
}
