import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { NavBar } from '@/components/layout/NavBar'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { MeetingList } from '@/components/meetings/MeetingList'
import { ScheduleMeetingDialog } from '@/components/meetings/ScheduleMeetingDialog'
import { TaskList } from '@/components/tasks/TaskList'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { PipelineTable } from '@/components/pipeline/PipelineTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClient } from '@/hooks/useClients'
import { useAssignClientTeam } from '@/hooks/useClients'
import { useTeams } from '@/hooks/useTeams'
import { cn } from '@/lib/utils'

const NO_TEAM = '__none__'
const TABS = ['Meetings', 'Tasks', 'Pipeline'] as const
type Tab = (typeof TABS)[number]

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('Meetings')

  const { data, isLoading } = useClient(id)
  const { data: teamsData } = useTeams()
  const assignTeam = useAssignClientTeam(id ?? '')

  const client = data?.client
  const teams = teamsData?.teams ?? []

  if (isLoading || !client || !id) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-6xl space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  const onTeamChange = (value: string) => {
    assignTeam.mutate(value === NO_TEAM ? null : value, {
      onSuccess: () => toast.success('Team updated'),
      onError: () => toast.error('Could not update team'),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter uppercase">{client.clientName}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground uppercase">{client.brandName}</p>
            <p className="text-xs text-muted-foreground">
              Registered {new Date(client.dateRegistered).toLocaleDateString()}
            </p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Team</span>
            <div className="flex items-center gap-2">
              <Select value={client.assignedTeam?._id ?? NO_TEAM} onValueChange={onTeamChange}>
                <SelectTrigger className="h-9 w-56 rounded-lg border font-medium normal-case tracking-normal">
                  <SelectValue placeholder="No team assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {client.assignedTeam?.leader && (
              <span className="text-xs text-muted-foreground">
                Lead: {client.assignedTeam.leader.firstName} {client.assignedTeam.leader.lastName ?? ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b-2 border-foreground">
          <div className="flex gap-4">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-2 pb-3 text-xs font-black tracking-widest uppercase text-muted-foreground',
                  tab === t && 'border-b-2 border-primary text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'Meetings' && <ScheduleMeetingDialog clientId={id} trigger={<Button size="sm">Schedule Meeting</Button>} />}
          {tab === 'Tasks' && <CreateTaskDialog clientId={id} />}
        </div>

        {tab === 'Meetings' && <MeetingList clientId={id} />}
        {tab === 'Tasks' && <TaskList clientId={id} />}
        {tab === 'Pipeline' && <PipelineTable clientId={id} />}
      </main>
    </div>
  )
}
