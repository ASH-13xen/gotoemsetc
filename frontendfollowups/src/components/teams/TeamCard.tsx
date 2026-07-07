import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Team } from '@/api/teams.api'
import { useDeleteTeam } from '@/hooks/useTeams'

export function TeamCard({ team }: { team: Team }) {
  const deleteTeam = useDeleteTeam()

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="uppercase tracking-wide">{team.name}</CardTitle>
          {team.description && <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteTeam.mutate(team._id)}
          disabled={deleteTeam.isPending}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {team.members.length === 0 ? (
          <span className="text-sm text-muted-foreground">No members yet.</span>
        ) : (
          team.members.map((m) => (
            <Badge key={m._id} variant="secondary">
              {m.firstName} {m.lastName}
            </Badge>
          ))
        )}
      </CardContent>
    </Card>
  )
}
