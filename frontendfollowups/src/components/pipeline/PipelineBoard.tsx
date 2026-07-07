import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PipelineStageCard } from '@/components/pipeline/PipelineStageCard'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { useTasks, useStartPipelineCycle } from '@/hooks/useTasks'
import type { Task, TaskStage } from '@/api/tasks.api'

export function PipelineBoard({ clientId }: { clientId: string }) {
  const { data, isLoading } = useTasks({ client: clientId, limit: 200 })
  const startCycle = useStartPipelineCycle()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const tasks = (data?.items ?? []).filter((t) => t.stage !== 'custom')
  const cycles = [...new Set(tasks.map((t) => t.cycle))].sort((a, b) => b - a)
  const latestCycle = cycles[0]
  const hasOpenCycle = tasks.some((t) => t.cycle === latestCycle && t.stage !== 'report')
  const openCycle = hasOpenCycle ? latestCycle : undefined

  function tasksForCycle(cycle: number) {
    return tasks.filter((t) => t.cycle === cycle)
  }

  function findStageTask(cycleTasks: Task[], stage: TaskStage) {
    return cycleTasks.find((t) => t.stage === stage)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black tracking-widest uppercase">Pipeline</h3>
        {!openCycle && (
          <Button
            size="sm"
            disabled={startCycle.isPending}
            onClick={() =>
              startCycle.mutate(clientId, {
                onSuccess: () => toast.success('New pipeline cycle started'),
                onError: () => toast.error('Could not start pipeline'),
              })
            }
          >
            {startCycle.isPending && <Loader2 className="size-4 animate-spin" />}
            <RefreshCw className="size-4" />
            Start New Cycle
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pipeline…</p>
      ) : cycles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pipeline cycle started yet for this client.</p>
      ) : (
        cycles.map((cycle) => {
          const cycleTasks = tasksForCycle(cycle)
          const isLatest = cycle === latestCycle
          return (
            <div key={cycle} className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">
                Cycle {cycle} {isLatest ? '(current)' : '(history)'}
              </span>
              <div className="flex flex-col gap-2 md:flex-row">
                <PipelineStageCard
                  label="Plan of Action"
                  task={findStageTask(cycleTasks, 'plan_of_action')}
                  onClick={() => setSelectedTask(findStageTask(cycleTasks, 'plan_of_action') ?? null)}
                />
                <div className="flex flex-1 flex-col gap-2 md:flex-row">
                  <PipelineStageCard
                    label="Post"
                    task={findStageTask(cycleTasks, 'post_creation')}
                    onClick={() => setSelectedTask(findStageTask(cycleTasks, 'post_creation') ?? null)}
                  />
                  <PipelineStageCard
                    label="Shoot"
                    task={findStageTask(cycleTasks, 'shoot')}
                    onClick={() => setSelectedTask(findStageTask(cycleTasks, 'shoot') ?? null)}
                  />
                  <PipelineStageCard
                    label="Edit/Design"
                    task={findStageTask(cycleTasks, 'edit_design')}
                    onClick={() => setSelectedTask(findStageTask(cycleTasks, 'edit_design') ?? null)}
                  />
                </div>
                <PipelineStageCard
                  label="Calendar"
                  task={findStageTask(cycleTasks, 'calendar')}
                  onClick={() => setSelectedTask(findStageTask(cycleTasks, 'calendar') ?? null)}
                />
                <PipelineStageCard
                  label="Report"
                  task={findStageTask(cycleTasks, 'report')}
                  onClick={() => setSelectedTask(findStageTask(cycleTasks, 'report') ?? null)}
                />
              </div>
            </div>
          )
        })
      )}

      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}
