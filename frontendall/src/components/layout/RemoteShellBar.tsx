import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// A slim persistent bar shown above every embedded remote app, so switching
// sections never requires the browser back button — the remote itself has no
// knowledge it's mounted inside a shell.
export function RemoteShellBar({ section }: { section: string }) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex items-center justify-between border-b-2 border-foreground bg-background px-4 py-2">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-1 text-xs font-bold tracking-widest uppercase hover:underline">
          <ArrowLeft className="size-3.5" />
          EMS Platform
        </Link>
        <span className="text-xs text-muted-foreground uppercase">/ {section}</span>
      </div>
      <div className="flex items-center gap-3">
        {user?.role === 'admin' && (
          <Link to="/audit-log" className="text-xs font-bold tracking-widest uppercase hover:underline">
            Audit Log
          </Link>
        )}
        <span className="text-xs text-muted-foreground uppercase">{user?.username}</span>
        <button onClick={signOut} aria-label="Sign out">
          <LogOut className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
