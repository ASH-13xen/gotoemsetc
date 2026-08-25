import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

// 'worker' is the underlying role name (permissions/auth logic stays
// keyed on it) — "Employee" is just the friendlier label shown in the UI.
const ROLE_LABEL: Record<string, string> = {
  admin: "admin",
  hr: "hr",
  worker: "employee",
};

export function ShellNav() {
  const { user, signOut } = useAuth();

  const links = [
    { to: "/", label: "Home", end: true },
    { to: "/ems", label: "EMS" },
    { to: "/sales", label: "Sales" },
    { to: "/followups", label: "Task Management" },
    ...(user?.role === "admin" || user?.role === "hr" || user?.role === "ceo"
      ? [{ to: "/hr", label: "HR Work" }]
      : []),
    ...(user?.role === "admin" || user?.role === "ceo" || user?.role === "operations_manager"
      ? [{ to: "/operations", label: "Operations" }]
      : []),
    ...(user?.role === "admin" || user?.role === "ceo" || user?.role === "account_manager" || user?.role === "operations_manager"
      ? [{ to: "/finance", label: "Finance" }]
      : []),
    ...(user?.role === "admin" || user?.role === "hr"
      ? [{ to: "/audit-log", label: "Audit Log" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-45 border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <span className="text-lg font-black tracking-tight text-foreground select-none">
            CRM Platform
          </span>
          <nav className="flex gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                // See ShellLayout.tsx's identical handler — a nested remote's
                // own BrowserRouter never sees a navigation driven from this
                // (outer) router unless nudged with a synthetic popstate.
                onClick={() => {
                  setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 0)
                }}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors duration-150 text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                    isActive && "text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="text-xs font-semibold text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
            {user?.username} •{" "}
            {user?.role ? (ROLE_LABEL[user.role] ?? user.role) : ""}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
