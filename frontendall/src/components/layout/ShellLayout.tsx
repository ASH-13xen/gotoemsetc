import { type ReactNode, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CalendarClock,
  Cake,
  ShieldAlert,
  LogOut,
  Menu,
  ChevronLeft
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { NotificationBell } from './NotificationBell'

export function ShellLayout({ children, section }: { children: ReactNode; section?: string }) {
  const { user, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/ems', label: 'EMS', icon: Users },
    { to: '/sales', label: 'Client Management', icon: DollarSign },
    { to: '/followups', label: 'Task Management', icon: CalendarClock },
    { to: '/birthdays', label: 'Birthdays', icon: Cake },
    ...(user?.role === 'admin' ? [{ to: '/audit-log', label: 'Audit Log', icon: ShieldAlert }] : []),
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col bg-card/75 backdrop-blur-xl border-r border-border/15 transition-all duration-300 z-50 shrink-0 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border/20">
          {!collapsed && (
            <span className="text-sm font-black tracking-widest text-primary uppercase select-none">
              EMS Platform
            </span>
          )}
          {collapsed && (
            <span className="text-xs font-black text-primary mx-auto">EMS</span>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-xl hover:bg-secondary/70 text-muted-foreground transition-all duration-200"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4.5 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`
                }
              >
                <Icon className="size-4.5 shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User profile & signout info */}
        <div className="p-4 border-t border-border/20 bg-secondary/15">
          <div className="flex items-center justify-between gap-3">
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate uppercase tracking-wider">
                  {user?.username}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                  {user?.role}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="hover:bg-destructive/10 hover:text-destructive rounded-xl size-9 shrink-0"
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
        <header className="h-16 flex items-center justify-between px-8 bg-background/60 backdrop-blur-md sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest bg-secondary/50 px-3 py-1.5 rounded-lg">
              Workspace / {section || 'Dashboard'}
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
  )
}
