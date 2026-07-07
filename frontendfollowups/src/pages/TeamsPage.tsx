import { NavBar } from '@/components/layout/NavBar'
import { TeamCard } from '@/components/teams/TeamCard'
import { CreateTeamDialog } from '@/components/teams/CreateTeamDialog'
import { useTeams } from '@/hooks/useTeams'

export default function TeamsPage() {
  const { data, isLoading } = useTeams()
  const teams = data?.teams ?? []

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Teams</h1>
          <CreateTeamDialog />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading teams…</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground uppercase">No teams yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <TeamCard key={team._id} team={team} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
