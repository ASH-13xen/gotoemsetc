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
    <header className="sticky top-0 z-45 border-b border-border bg-card/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <span className="text-lg font-extrabold tracking-tight text-foreground select-none">
            Followups
          </span>
          <nav className="flex gap-2">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                    isActive && 'text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground bg-secondary/80 px-3 py-1.5 rounded-full uppercase tracking-wider">
            {user?.username} • {user?.role}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
