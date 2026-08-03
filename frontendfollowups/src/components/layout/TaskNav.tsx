import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useReviewTasks } from '@/hooks/useEmployeeTasks'
import { canManageTasks } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50',
    isActive && 'text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary'
  )

export function TaskNav() {
  const { user, signOut } = useAuth()
  const { data: reviewData } = useReviewTasks()
  const isReviewer = reviewData?.isReviewer ?? false
  const reviewCount = reviewData?.tasks.length ?? 0
  const admin = canManageTasks(user)

  const registryLinks = [
    { to: '/teams', label: 'Teams' },
    { to: '/clients', label: 'Clients' },
    { to: '/events', label: 'Events' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-lg font-extrabold tracking-tight text-foreground select-none">Task Management</span>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/tasks" className={linkClass}>
              Tasks
            </NavLink>
            {isReviewer && (
              <NavLink to="/review" className={linkClass}>
                Review
                {reviewCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                    {reviewCount}
                  </span>
                )}
              </NavLink>
            )}
            {admin && (
              <span className="mx-1 self-center text-muted-foreground/30">|</span>
            )}
            {admin &&
              registryLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={linkClass}>
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
