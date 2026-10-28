import { useState } from "react";
import { hasPermission, type Business, type Employee } from "@auxo/core";
import { setSession } from "../appState.js";
import AppShell, { type NavItem } from "../components/AppShell.js";
import DashboardScreen from "./DashboardScreen.js";
import BillingScreen from "./BillingScreen.js";
import InventoryScreen from "./InventoryScreen.js";
import CustomersScreen from "./CustomersScreen.js";
import InvoiceHistoryScreen from "./InvoiceHistoryScreen.js";
import ReportsScreen from "./ReportsScreen.js";
import EmployeesScreen from "./EmployeesScreen.js";
import SettingsScreen from "./SettingsScreen.js";

interface HomeScreenProps {
  business: Business;
  currentEmployee: Employee;
  onSignedOut: () => void;
  onRestored: () => void | Promise<void>;
}

type Section = "dashboard" | "pos" | "inventory" | "customers" | "history" | "reports" | "employees" | "settings";

export default function HomeScreen({ business, currentEmployee, onSignedOut, onRestored }: HomeScreenProps) {
  const [section, setSection] = useState<Section>("dashboard");

  const canViewInventory = hasPermission(currentEmployee, "inventory.view");
  const canEditInventory = hasPermission(currentEmployee, "inventory.edit");
  const canBill = hasPermission(currentEmployee, "billing.create");
  const canVoidBill = hasPermission(currentEmployee, "billing.void");
  const canViewCustomers = hasPermission(currentEmployee, "customers.view");
  const canEditCustomers = hasPermission(currentEmployee, "customers.edit");
  const canViewHistory = canBill || hasPermission(currentEmployee, "reports.view");
  const canViewReports = hasPermission(currentEmployee, "reports.view");
  const isSuperAdmin = currentEmployee.role === "super_admin";

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", show: true },
    { key: "pos", label: "POS", show: canBill },
    { key: "inventory", label: "Inventory", show: canViewInventory },
    { key: "customers", label: "Customers", show: canViewCustomers },
    { key: "history", label: "Invoice history", show: canViewHistory },
    { key: "reports", label: "Reports", show: canViewReports },
    { key: "employees", label: "Employees", show: isSuperAdmin },
    { key: "settings", label: "Settings", show: isSuperAdmin },
  ];

  async function signOut() {
    await setSession(null);
    onSignedOut();
  }

  return (
    <AppShell
      business={business}
      currentEmployee={currentEmployee}
      navItems={navItems}
      activeKey={section}
      onNavigate={(key) => setSection(key as Section)}
      onSignOut={() => void signOut()}
    >
      {section === "dashboard" && <DashboardScreen canViewFinancials={canViewReports || isSuperAdmin} />}
      {section === "pos" && canBill && (
        <BillingScreen business={business} currentEmployee={currentEmployee} canVoid={canVoidBill} />
      )}
      {section === "inventory" && canViewInventory && <InventoryScreen canEdit={canEditInventory} />}
      {section === "customers" && canViewCustomers && <CustomersScreen canEdit={canEditCustomers} />}
      {section === "history" && canViewHistory && <InvoiceHistoryScreen business={business} />}
      {section === "reports" && canViewReports && <ReportsScreen />}
      {section === "employees" && isSuperAdmin && <EmployeesScreen />}
      {section === "settings" && isSuperAdmin && <SettingsScreen business={business} onRestored={onRestored} />}
    </AppShell>
  );
}
