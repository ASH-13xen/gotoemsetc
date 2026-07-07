import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clients', label: 'Clients' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/teams', label: 'Teams' },
]

export function NavBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="border-b-2 border-foreground bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-black tracking-widest uppercase">Followups</span>
          <nav className="flex gap-4">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground',
                    isActive && 'text-foreground underline underline-offset-4'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground uppercase">
            {user?.username} ({user?.role})
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
