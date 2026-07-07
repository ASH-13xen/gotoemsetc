import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { NavBar } from '@/components/layout/NavBar'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { PipelineBoard } from '@/components/pipeline/PipelineBoard'
import { MeetingHistoryList } from '@/components/meetings/MeetingHistoryList'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { KanbanColumn } from '@/components/tasks/KanbanColumn'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { useClient } from '@/hooks/useClients'
import { useTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import type { Task } from '@/api/tasks.api'

const TABS = ['Pipeline', 'Meetings', 'Tasks'] as const
type Tab = (typeof TABS)[number]

export default function ClientPipelinePage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('Pipeline')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const { data } = useClient(id)
  const { data: adhocData } = useTasks({ client: id, stage: 'custom', limit: 100 })

  const client = data?.client

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {client && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">{client.clientName}</h1>
              <p className="text-sm text-muted-foreground uppercase">{client.brandName}</p>
            </div>
            <ClientStatusBadge status={client.status} />
          </div>
        )}

        <div className="flex gap-4 border-b-2 border-foreground">
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

        {tab === 'Pipeline' && id && <PipelineBoard clientId={id} />}
        {tab === 'Meetings' && id && <MeetingHistoryList clientId={id} />}
        {tab === 'Tasks' && id && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <CreateTaskDialog clientId={id} />
            </div>
            <KanbanColumn
              title="Ad-hoc Tasks"
              tasks={adhocData?.items ?? []}
              onTaskClick={setSelectedTask}
            />
          </div>
        )}

        <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
      </main>
    </div>
  )
}
