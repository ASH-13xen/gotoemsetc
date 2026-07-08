import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

import { NavBar } from '@/components/layout/NavBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TeamFormDialog } from '@/components/teams/TeamFormDialog'
import { useDeleteTeam, useTeams } from '@/hooks/useTeams'

export default function TeamsPage() {
  const { data, isLoading } = useTeams()
  const deleteTeam = useDeleteTeam()
  const teams = data?.teams ?? []

  const onDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete team "${name}"?`)) return
    deleteTeam.mutate(id, {
      onSuccess: () => toast.success('Team deleted'),
      onError: () => toast.error('Could not delete team'),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Teams</h1>
          <TeamFormDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                New Team
              </Button>
            }
          />
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="grid gap-3">
            {teams.map((team) => (
              <div key={team._id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-bold">{team.name}</p>
                  {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {team.members.length} member{team.members.length === 1 ? '' : 's'}
                    {team.leader && ` · Lead: ${team.leader.firstName} ${team.leader.lastName ?? ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TeamFormDialog team={team} trigger={<Button size="sm" variant="outline">Edit</Button>} />
                  <Button size="icon" variant="ghost" onClick={() => onDelete(team._id, team.name)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
