import { useState, type ReactNode } from "react";
import type { Business, Employee } from "@auxo/core";
import { Menu, LogOut, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  show: boolean;
  icon: LucideIcon;
}

interface AppShellProps {
  business: Business;
  currentEmployee: Employee;
  navItems: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}

/**
 * The shared application shell: a collapsible left sidebar (nav items
 * filtered by the caller to what the signed-in employee can see), a top
 * header, and a main content area. Pages render inside `children` and
 * pick their own layout from there — the POS screen, for instance, uses
 * its own three-region layout within this shell.
 */
export default function AppShell({
  business,
  currentEmployee,
  navItems,
  activeKey,
  onNavigate,
  onSignOut,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((i) => i.show);

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        <Menu size={20} />
      </button>

      <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="app-sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          {!collapsed && (
            <span className="brand-wordmark">
              Auxo
              <span className="brand-tagline">Built to grow.</span>
            </span>
          )}
        </div>

        <nav className="app-sidebar-nav" aria-label="Primary">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`sidebar-nav-item ${activeKey === item.key ? "active" : ""}`}
                onClick={() => {
                  onNavigate(item.key);
                  setMobileOpen(false);
                }}
                aria-current={activeKey === item.key ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={2} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "« Collapse"}
        </button>
      </aside>

      <div className="app-shell-main">
        <header className="app-top-header">
          <h1 className="app-shop-name">{business.name}</h1>
          <div className="app-header-user">
            <span className="muted">
              {currentEmployee.name} · {currentEmployee.role === "super_admin" ? "Super Admin" : "Employee"}
            </span>
            <button type="button" className="icon-button" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
