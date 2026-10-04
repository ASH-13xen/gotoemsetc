import { type ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Network,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/roles";
import { can, featureOn } from "@/lib/access";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import "./ShellLayout.css";

// Display names for the underlying role values (permissions/auth logic stays
// keyed on the raw names) — e.g. 'worker' shows as "Employee". Single source
// of truth in lib/roles.ts, mirroring the backend's ROLE_HIERARCHY.

export function ShellLayout({
  children,
  section,
  fullBleed = false,
  wide = false,
}: {
  children: ReactNode;
  section?: string;
  // Edge-to-edge content with no max width or padding — for canvases like
  // the Organisation chart that manage their own space.
  fullBleed?: boolean;
  // Normal padding and scrolling, but no max width — for wide grids like
  // the Weekly Calendar.
  wide?: boolean;
}) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  // Off-canvas drawer state for narrow viewports — the sidebar below md is
  // fully hidden (translate-x-full) rather than permanently occupying a
  // third of a phone's width, which is what was clipping/squeezing content
  // on mobile before. Independent of `collapsed`, which is a desktop-only
  // icon-rail toggle and has no meaning on a drawer that's either fully open
  // or fully closed.
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the drawer automatically on every route change — otherwise a link
  // tap on mobile would leave the overlay sitting open on top of the page it
  // just navigated to.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Every link follows the person's live access (lib/access.ts) — their
  // login plus the Organisation chart posts they hold.
  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    // Everyone: their own record; admin/CEO/HR: everyone's.
    { to: "/ems", label: "EMS", icon: Users },
    // Everyone plans their week here — meetings, events, blocked time.
    { to: "/calendar", label: "Weekly Calendar", icon: CalendarDays },
    // Hidden while switched off (backend constants.js FEATURES).
    ...(featureOn(user, "TASK_MANAGEMENT")
      ? [{ to: "/followups", label: "Task Management", icon: CalendarClock }]
      : []),
    ...(featureOn(user, "CLIENT_MANAGEMENT")
      ? [{ to: "/sales", label: "Client Management", icon: Briefcase }]
      : []),
    ...(can(user, "hrms") ? [{ to: "/hr", label: "HR Work", icon: ClipboardList }] : []),
    ...(can(user, "events") ? [{ to: "/events", label: "Events", icon: CalendarClock }] : []),
    ...(can(user, "operations") ? [{ to: "/operations", label: "Operations", icon: Wrench }] : []),
    ...(can(user, "finance") ? [{ to: "/finance", label: "Finance", icon: Wallet }] : []),
    ...(can(user, "performance_flags")
      ? [{ to: "/performance-flags", label: "Performance Flags", icon: Flag }]
      : []),
    ...(can(user, "audit_log") ? [{ to: "/audit-log", label: "Audit Log", icon: ShieldAlert }] : []),
    // Everyone can view the chart; only admin can change it.
    { to: "/organisation", label: "Organisation", icon: Network },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile backdrop — covers the whole viewport (including the top
          bar) while the drawer is open, so a tap anywhere outside the
          sidebar closes it instead of interacting with the page behind it. */}
      {mobileOpen && (
        <div
          className="shell-backdrop fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — an off-canvas drawer below md (fixed, slides in/out,
          full label width regardless of `collapsed`), the original
          icon-rail/full sidebar at md and up. Position/width/transform
          come from the hand-written, un-layered rules in ShellLayout.css,
          not plain Tailwind utilities — see that file for why: a Tailwind
          `md:static` here is not reliably safe from being overridden once
          a remote app's own compiled CSS lands in this shared document. */}
      <aside
        data-open={mobileOpen}
        data-collapsed={collapsed}
        className={cn("shell-aside flex flex-col bg-card border-r border-border shrink-0")}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border shrink-0">
          <span
            className={cn(
              "text-lg font-black tracking-tight text-primary select-none",
              collapsed && "md:hidden"
            )}
          >
            CRM Platform
          </span>
          {collapsed && (
            <span className="hidden text-xs font-black text-primary mx-auto md:inline">
              EMS
            </span>
          )}
          {/* Desktop-only collapse toggle — meaningless on a drawer that's
              always either fully open or fully closed. */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors duration-150 md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <Menu className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
          {/* Mobile-only close button for the drawer. */}
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors duration-150 md:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
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
                  setMobileOpen(false);
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
                <span className={cn("truncate", collapsed && "md:hidden")}>
                  {link.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & signout info */}
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className={cn("flex flex-col min-w-0", collapsed && "md:hidden")}>
              <span className="text-sm font-bold text-foreground truncate">
                {user?.displayName ?? user?.username}
              </span>
              {/* Their login role plus every post they hold, e.g. "Employee · HR". */}
              <span className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                {(user?.roles ?? [user?.role]).map((r) => roleLabel(r)).join(" · ")}
              </span>
            </div>
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
        <header className="h-14 md:h-16 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 bg-background border-b border-border sticky top-0 z-30 shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="-ml-1.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-secondary md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <span className="truncate text-xs font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg">
              Workspace / {section || "Dashboard"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Workspace body */}
        <main
          className={cn(
            "flex-1 w-full",
            fullBleed
              ? "relative overflow-hidden"
              : wide
                ? "overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5"
                : "overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 max-w-6xl mx-auto"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
