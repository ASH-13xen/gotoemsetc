import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">
          Welcome, <span className="font-semibold text-primary">{user?.username}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          This dashboard is currently empty. You can customize this space with telemetry metrics, summary reports, and active workflow tools.
        </p>
      </div>

      {/* Placeholder container for future widgets */}
      <div className="min-h-[400px] rounded-2xl border border-dashed border-border/60 bg-secondary/15 flex items-center justify-center p-8">
        <span className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
          Widget Workspace Placeholder
        </span>
      </div>
    </div>
  )
}
