import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// A slim persistent bar shown above every embedded remote app, so switching
// sections never requires the browser back button — the remote itself has no
// knowledge it's mounted inside a shell.
export function RemoteShellBar({ section }: { section: string }) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-1 text-xs font-bold tracking-wider uppercase text-primary hover:text-primary/80 transition-colors">
          <ArrowLeft className="size-3.5" />
          EMS Platform
        </Link>
        <span className="text-xs font-semibold text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-full uppercase tracking-wider">/ {section}</span>
      </div>
      <div className="flex items-center gap-4">
        {(user?.role === 'admin' || user?.role === 'hr') && (
          <Link to="/audit-log" className="text-xs font-bold tracking-wider uppercase text-foreground hover:text-primary transition-colors">
            Audit Log
          </Link>
        )}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{user?.username}</span>
        <button onClick={signOut} aria-label="Sign out" className="p-1.5 hover:bg-secondary rounded-full transition-all text-muted-foreground hover:text-foreground">
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
