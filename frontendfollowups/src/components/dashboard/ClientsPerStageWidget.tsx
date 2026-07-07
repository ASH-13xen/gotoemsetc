import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ClientStageSummary } from '@/api/dashboard.api'

const STAGE_LABELS: Record<string, string> = {
  plan_of_action: 'Plan of Action',
  post_creation: 'Post',
  shoot: 'Shoot',
  edit_design: 'Edit/Design',
  calendar: 'Calendar',
  report: 'Report',
}

export function ClientsPerStageWidget({ clients }: { clients: ClientStageSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-widest">Clients by Stage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active pipelines.</p>
        ) : (
          clients.map((c) => (
            <div key={c._id} className="flex items-center justify-between border-2 border-foreground/30 p-2">
              <span className="text-sm font-bold uppercase">{c.clientName}</span>
              <Badge variant={c.latestStatus === 'blocked' ? 'warning' : 'secondary'}>
                {STAGE_LABELS[c.latestStage] ?? c.latestStage}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
