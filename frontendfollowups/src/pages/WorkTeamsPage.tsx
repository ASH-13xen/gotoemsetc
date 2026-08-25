import { toast } from 'sonner'
import { Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { WorkTeamFormDialog } from '@/components/teams/WorkTeamFormDialog'
import { useAuth } from '@/hooks/useAuth'
import { canManageTeamRegistry } from '@/lib/permissions'
import { useDeleteWorkTeam, useWorkTeams } from '@/hooks/useWorkTeams'
import { membersWithRole, TEAM_MEMBER_ROLE_LABEL, type WorkTeam } from '@/api/workTeams.api'

function roleChips(team: WorkTeam) {
  const roleSet = new Set((team.memberRoles ?? []).flatMap((r) => r.roles))
  return Array.from(roleSet).map((role) => {
    const holders = membersWithRole(team, role)
    return { role, label: TEAM_MEMBER_ROLE_LABEL[role], holders }
  })
}

// No page-level gate — the backend already lets any authenticated employee
// view team rosters (pickers, who leads what), including a team's own
// Team Main who otherwise couldn't see their own team here. Only the
// mutating controls below (New Team / Edit / Delete) are gated.
export default function WorkTeamsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useWorkTeams()
  const deleteTeam = useDeleteWorkTeam()
  const canManage = canManageTeamRegistry(user)

  const teams = data?.teams ?? []

  const onDelete = (id: string, name: string) => {
    if (!window.confirm(`Remove team "${name}"?`)) return
    deleteTeam.mutate(id, {
      onSuccess: () => toast.success('Team removed'),
      onError: () => toast.error('Could not remove team'),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Teams</h1>
          {canManage && (
            <WorkTeamFormDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New Team
                </Button>
              }
            />
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
        ) : teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <Card key={team._id} className="p-6">
                <CardHeader className="flex-row items-start justify-between px-0 pt-0">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    {team.name}
                  </CardTitle>
                  {canManage && (
                    <div className="flex gap-1">
                      <WorkTeamFormDialog team={team} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                      <Button variant="ghost" size="icon" onClick={() => onDelete(team._id, team.name)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 px-0">
                  {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Team Main</p>
                  <p className="text-sm font-semibold">
                    {team.leader.firstName} {team.leader.lastName ?? ''}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Members ({team.members.length})
                  </p>
                  <p className="text-sm">
                    {team.members.map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim()).join(', ') || '—'}
                  </p>
                  {roleChips(team).length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {roleChips(team).map(({ role, label, holders }) => (
                          <Badge key={role} variant="outline" className="font-normal">
                            {label}: {holders.map((h) => `${h.firstName} ${h.lastName ?? ''}`.trim()).join(', ')}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
