import { useState } from "react";
import { hasPermission, type Business, type Employee } from "@auxo/core";
import { setSession } from "../appState.js";
import AppShell, { type NavItem } from "../components/AppShell.js";
import DashboardScreen from "./DashboardScreen.js";
import BillingScreen from "./BillingScreen.js";
import ProductsScreen from "./ProductsScreen.js";
import InventoryScreen from "./InventoryScreen.js";
import CustomersScreen from "./CustomersScreen.js";
import InvoiceHistoryScreen from "./InvoiceHistoryScreen.js";
import SuppliersScreen from "./SuppliersScreen.js";
import PurchasesScreen from "./PurchasesScreen.js";
import ReturnsScreen from "./ReturnsScreen.js";
import DayClosingScreen from "./DayClosingScreen.js";
import ActivityLogScreen from "./ActivityLogScreen.js";
import ReportsScreen from "./ReportsScreen.js";
import EmployeesScreen from "./EmployeesScreen.js";
import SettingsScreen from "./SettingsScreen.js";

interface HomeScreenProps {
  business: Business;
  currentEmployee: Employee;
  onSignedOut: () => void;
  onRestored: () => void | Promise<void>;
}

type Section =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "customers"
  | "history"
  | "returns"
  | "dayClosing"
  | "suppliers"
  | "purchases"
  | "reports"
  | "employees"
  | "activityLog"
  | "settings";

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
  const canViewPurchases = hasPermission(currentEmployee, "purchases.view");
  const canEditPurchases = hasPermission(currentEmployee, "purchases.edit");
  const isSuperAdmin = currentEmployee.role === "super_admin";

  const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", show: true },
    { key: "pos", label: "POS", show: canBill },
    { key: "products", label: "Products", show: canViewInventory },
    { key: "inventory", label: "Inventory", show: canViewInventory },
    { key: "customers", label: "Customers", show: canViewCustomers },
    { key: "history", label: "Invoice history", show: canViewHistory },
    { key: "returns", label: "Returns", show: canViewHistory },
    { key: "dayClosing", label: "Day closing", show: canBill },
    { key: "suppliers", label: "Suppliers", show: canViewPurchases },
    { key: "purchases", label: "Purchases", show: canViewPurchases },
    { key: "reports", label: "Reports", show: canViewReports },
    { key: "employees", label: "Employees", show: isSuperAdmin },
    { key: "activityLog", label: "Activity log", show: isSuperAdmin },
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
      {section === "products" && canViewInventory && (
        <ProductsScreen canEdit={canEditInventory} currentEmployee={currentEmployee} />
      )}
      {section === "inventory" && canViewInventory && (
        <InventoryScreen canEdit={canEditInventory} currentEmployee={currentEmployee} />
      )}
      {section === "customers" && canViewCustomers && (
        <CustomersScreen canEdit={canEditCustomers} business={business} currentEmployee={currentEmployee} />
      )}
      {section === "history" && canViewHistory && <InvoiceHistoryScreen business={business} />}
      {section === "returns" && canViewHistory && (
        <ReturnsScreen canEdit={canVoidBill} currentEmployee={currentEmployee} />
      )}
      {section === "dayClosing" && canBill && (
        <DayClosingScreen canEdit={canBill} currentEmployee={currentEmployee} />
      )}
      {section === "suppliers" && canViewPurchases && (
        <SuppliersScreen canEdit={canEditPurchases} currentEmployee={currentEmployee} />
      )}
      {section === "purchases" && canViewPurchases && (
        <PurchasesScreen canEdit={canEditPurchases} currentEmployee={currentEmployee} />
      )}
      {section === "reports" && canViewReports && <ReportsScreen />}
      {section === "employees" && isSuperAdmin && <EmployeesScreen currentEmployee={currentEmployee} />}
      {section === "activityLog" && isSuperAdmin && <ActivityLogScreen />}
      {section === "settings" && isSuperAdmin && <SettingsScreen business={business} onRestored={onRestored} />}
    </AppShell>
  );
}
