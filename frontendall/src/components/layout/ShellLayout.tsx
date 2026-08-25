import { type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  CalendarDays,
  Briefcase,
  ShieldAlert,
  LogOut,
  Menu,
  ChevronLeft,
  ClipboardList,
  Wrench,
  Wallet,
  Flag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/roles";
import { NotificationBell } from "./NotificationBell";

// Display names for the underlying role values (permissions/auth logic stays
// keyed on the raw names) — e.g. 'worker' shows as "Employee". Single source
// of truth in lib/roles.ts, mirroring the backend's ROLE_HIERARCHY.

export function ShellLayout({
  children,
  section,
}: {
  children: ReactNode;
  section?: string;
}) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Deliberately only admin + HR — the newer roles (ceo, digital admin,
  // operations/account manager, team lead) have no permissions wired up yet,
  // so Audit Log stays admin/HR-only until they do.
  const isAdmin = user?.role === "admin" || user?.role === "hr";
  // HR Work additionally lets ceo in, matching the backend's
  // requireAttendanceApprovalAccess and the HR Work routes it gates.
  const canAccessHrWork = isAdmin || user?.role === "ceo";
  // Operations (Complaint Register, Office Keys reassignment) — admin/ceo/
  // operations_manager only, matching the backend's requireOperationsAccess.
  // Deliberately NOT isAdmin above: HR is excluded from this one on purpose.
  const canAccessOperations =
    user?.role === "admin" || user?.role === "ceo" || user?.role === "operations_manager";
  // Finance — admin/ceo/account_manager, matching the backend's
  // requireFinanceAccess, widened to operations_manager since that role
  // still needs the remote for the Monthly Bills tab (see
  // frontendfinance/src/lib/roles.ts#canEnterFinance).
  const canAccessFinance =
    isAdmin ||
    user?.role === "ceo" ||
    user?.role === "account_manager" ||
    user?.role === "operations_manager";
  // Performance Flags history — same admin/hr/ceo audience the flag
  // milestone notifications go to (backend's requireHrWorkAccess).
  const canAccessPerformanceFlags = canAccessHrWork;

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/ems", label: "EMS", icon: Users },
    // Unconditional — every role can view; the calendar's own management
    // actions (mark holiday/half day, add events) are gated inline via
    // canManage, matching canAccessHrWork below.
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    // Every employee needs Task Management and Client Management —
    // role-dependent capability differences are handled inside each feature,
    // not at the nav.
    { to: "/followups", label: "Task Management", icon: CalendarClock },
    { to: "/sales", label: "Client Management", icon: Briefcase },
    ...(canAccessHrWork
      ? [{ to: "/hr", label: "HR Work", icon: ClipboardList }]
      : []),
    ...(canAccessOperations
      ? [{ to: "/operations", label: "Operations", icon: Wrench }]
      : []),
    ...(canAccessFinance
      ? [{ to: "/finance", label: "Finance", icon: Wallet }]
      : []),
    ...(canAccessPerformanceFlags
      ? [{ to: "/performance-flags", label: "Performance Flags", icon: Flag }]
      : []),
    ...(isAdmin
      ? [{ to: "/audit-log", label: "Audit Log", icon: ShieldAlert }]
      : []),
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-card border-r border-border transition-all duration-300 z-50 shrink-0 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          {!collapsed && (
            <span className="text-lg font-black tracking-tight text-primary select-none">
              CRM Platform
            </span>
          )}
          {collapsed && (
            <span className="text-xs font-black text-primary mx-auto">EMS</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors duration-150"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <Menu className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                // Each remote (frontendems/frontendsales/frontendfollowups)
                // mounts its own <BrowserRouter>, nested inside this app's —
                // a navigation driven from here (the outer router) changes
                // the address bar but is invisible to the inner router's own
                // history instance, so clicking e.g. "EMS" while already deep
                // inside /ems/* silently does nothing. A synthetic popstate
                // on the next tick is what the inner router already listens
                // for (that's how back/forward works), so this makes it
                // resync to the new URL immediately.
                onClick={() => {
                  setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0)
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4.5 py-3 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <Icon className="size-4.5 shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & signout info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between gap-3">
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-foreground truncate">
                  {user?.username}
                </span>
                <span className="text-xs font-medium text-muted-foreground mt-0.5">
                  {roleLabel(user?.role)}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="hover:bg-destructive/10 hover:text-destructive rounded-lg size-9 shrink-0"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content body */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-8 bg-background border-b border-border sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg">
              Workspace / {section || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Workspace body */}
        <main className="flex-1 overflow-y-auto px-8 py-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
