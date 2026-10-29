import { useState } from "react";
import { hasPermission, type Business, type Employee } from "@auxo/core";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Receipt,
  Undo2,
  Lock,
  Truck,
  ShoppingBag,
  BarChart3,
  Percent,
  Gift,
  UserCog,
  History,
  Settings as SettingsIcon,
} from "lucide-react";
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
import TaxReportScreen from "./TaxReportScreen.js";
import LoyaltyScreen from "./LoyaltyScreen.js";
import EmployeesScreen from "./EmployeesScreen.js";
import SettingsScreen from "./SettingsScreen.js";

interface HomeScreenProps {
  business: Business;
  currentEmployee: Employee;
  onSignedOut: () => void;
  onRestored: () => void | Promise<void>;
  onBusinessUpdated: () => void | Promise<void>;
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
  | "taxReport"
  | "loyalty"
  | "employees"
  | "activityLog"
  | "settings";

export default function HomeScreen({
  business,
  currentEmployee,
  onSignedOut,
  onRestored,
  onBusinessUpdated,
}: HomeScreenProps) {
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
    { key: "dashboard", label: "Dashboard", show: true, icon: LayoutDashboard },
    { key: "pos", label: "POS", show: canBill, icon: ShoppingCart },
    { key: "products", label: "Products", show: canViewInventory, icon: Package },
    { key: "inventory", label: "Inventory", show: canViewInventory, icon: Boxes },
    { key: "customers", label: "Customers", show: canViewCustomers, icon: Users },
    { key: "history", label: "Invoice history", show: canViewHistory, icon: Receipt },
    { key: "returns", label: "Returns", show: canViewHistory, icon: Undo2 },
    { key: "dayClosing", label: "Day closing", show: canBill, icon: Lock },
    { key: "suppliers", label: "Suppliers", show: canViewPurchases, icon: Truck },
    { key: "purchases", label: "Purchases", show: canViewPurchases, icon: ShoppingBag },
    { key: "reports", label: "Reports", show: canViewReports, icon: BarChart3 },
    { key: "taxReport", label: "Tax report", show: canViewReports, icon: Percent },
    { key: "loyalty", label: "Loyalty", show: canViewCustomers, icon: Gift },
    { key: "employees", label: "Employees", show: isSuperAdmin, icon: UserCog },
    { key: "activityLog", label: "Activity log", show: isSuperAdmin, icon: History },
    { key: "settings", label: "Settings", show: isSuperAdmin, icon: SettingsIcon },
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
      {section === "taxReport" && canViewReports && <TaxReportScreen business={business} />}
      {section === "loyalty" && canViewCustomers && (
        <LoyaltyScreen canEdit={canEditCustomers} currentEmployee={currentEmployee} />
      )}
      {section === "employees" && isSuperAdmin && <EmployeesScreen currentEmployee={currentEmployee} />}
      {section === "activityLog" && isSuperAdmin && <ActivityLogScreen />}
      {section === "settings" && isSuperAdmin && (
        <SettingsScreen business={business} onRestored={onRestored} onBusinessUpdated={onBusinessUpdated} />
      )}
    </AppShell>
  );
}
