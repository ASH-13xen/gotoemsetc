import { NavBar } from '@/components/layout/NavBar'
import { OverdueTasksWidget } from '@/components/dashboard/OverdueTasksWidget'
import { UpcomingMeetingsWidget } from '@/components/dashboard/UpcomingMeetingsWidget'
import { ClientsPerStageWidget } from '@/components/dashboard/ClientsPerStageWidget'
import { useFollowupsStats } from '@/hooks/useDashboard'

export default function DashboardPage() {
  const { data, isLoading } = useFollowupsStats()

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Dashboard</h1>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <OverdueTasksWidget tasks={data?.overdueTasks ?? []} />
            <UpcomingMeetingsWidget meetings={data?.upcomingMeetings ?? []} />
            <ClientsPerStageWidget clients={data?.clientsByStage ?? []} />
          </div>
        )}
      </main>
    </div>
  )
}
