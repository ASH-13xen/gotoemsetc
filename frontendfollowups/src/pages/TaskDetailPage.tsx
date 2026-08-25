import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import { FollowUpList } from '@/components/tasks/FollowUpList'
import { ResourcesContactsSection } from '@/components/tasks/ResourcesContactsSection'
import { CompleteTaskButton, FinishTaskButton, MarkForReviewButton } from '@/components/tasks/TaskActions'
import { RejectTaskDialog } from '@/components/tasks/RejectTaskDialog'
import { ContinueTaskDialog } from '@/components/tasks/ContinueTaskDialog'
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog'
import { CreateSubtaskDialog } from '@/components/tasks/CreateSubtaskDialog'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskChain } from '@/components/tasks/TaskChain'
import { useAuth } from '@/hooks/useAuth'
import { useLedTeams } from '@/hooks/useLedTeams'
import { useDeleteTask, useSubtasks, useTask } from '@/hooks/useEmployeeTasks'
import { useCmsItem } from '@/hooks/useCmsItem'
import { PipelineStepper } from '@/components/tasks/PipelineStepper'
import { MomPipelinePanel } from '@/components/tasks/MomPipelinePanel'
import {
  canCreateContinuation,
  canCreateSubtask,
  canManageTask,
  canMarkCompleted,
  canMarkCompletedDirect,
  canMarkForReview,
  canRejectTask,
} from '@/lib/taskAccess'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const ledTeams = useLedTeams()
  const ledTeamMemberIds = ledTeams.flatMap((t) => [t.leader._id, ...t.members.map((m) => m._id)])
  const { data, isLoading } = useTask(id)
  const { data: subtasksData } = useSubtasks(id)
  const deleteTask = useDeleteTask()
  const { data: cmsItem } = useCmsItem(data?.task.cmsItem)

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <TaskNav />
        <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
          <Skeleton className="h-8 w-48 rounded-xl bg-secondary/40" />
          <Skeleton className="h-64 w-full rounded-2xl bg-secondary/40" />
        </main>
      </div>
    )
  }

  const task = data.task
  const subtasks = subtasksData?.subtasks ?? []
  // Edit/Delete on the shared PATCH/DELETE /:id route — mirrors the
  // backend's canManageOwnTask: manage_tasks/manage_subtasks, or the team
  // leader for their own top-level task (any type, including a personal
  // task they assigned to a team member).
  const admin = canManageTask(user, task, ledTeamMemberIds)

  const onDelete = () => {
    if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return
    deleteTask.mutate(task._id, {
      onSuccess: () => {
        toast.success('Task deleted')
        navigate('/tasks')
      },
      onError: () => toast.error('Could not delete task'),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <Card className="space-y-6 p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {task.client && (
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{task.client.name}</p>
              )}
              {task.event && <p className="text-xs font-bold uppercase tracking-widest text-primary">{task.event.name}</p>}
              {task.continuesFrom && (
                <p className="text-xs font-semibold text-muted-foreground">
                  Continuation of{' '}
                  <Link to={`/tasks/${task.continuesFrom._id}`} className="text-primary hover:underline">
                    {task.continuesFrom.title}
                  </Link>
                </p>
              )}
              <h1 className="text-2xl font-extrabold text-foreground">{task.title}</h1>
              {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <TaskStatusBadge task={task} />
              {admin && (
                <div className="flex gap-1">
                  <EditTaskDialog task={task} />
                  <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleteTask.isPending}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start</p>
              <p className="font-semibold text-foreground">{formatDateTime(task.startAt)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Due</p>
              <p className="font-semibold text-foreground">{formatDateTime(task.endAt)}</p>
            </div>
          </div>

          {task.type === 'personal' ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assigned To</p>
              <p className="text-sm font-semibold text-foreground">
                {task.assignedEmployees.map((e) => `${e.firstName} ${e.lastName ?? ''}`.trim()).join(', ') || '—'}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Users2 className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Team: {task.team?.name}</p>
                <p className="text-sm text-foreground">
                  Leader:{' '}
                  {task.team?.leader ? `${task.team.leader.firstName} ${task.team.leader.lastName ?? ''}`.trim() : '—'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Members: {task.team?.members.map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim()).join(', ') || '—'}
                </p>
                {task.extraMembers.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Extra: {task.extraMembers.map((m) => `${m.firstName} ${m.lastName ?? ''}`.trim()).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {cmsItem && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Client pipeline — {cmsItem.label}
              </p>
              <PipelineStepper trail={cmsItem.trail} isSentBack={cmsItem.isSentBack} isRejected={cmsItem.isRejected} />
            </div>
          )}

          {task.momPipeline?.kind && data.momPipelineView && (
            <MomPipelinePanel task={task} view={data.momPipelineView} />
          )}

          <ResourcesContactsSection resources={task.resourcesRequired} contacts={task.contactsRequired} />

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Follow-ups</p>
            <FollowUpList task={task} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4">
            {canMarkForReview(user, task) && <MarkForReviewButton task={task} />}
            {canMarkCompletedDirect(user, task) && <FinishTaskButton task={task} />}
            {canMarkCompleted(user, task) && <CompleteTaskButton task={task} />}
            {canRejectTask(user, task) && <RejectTaskDialog task={task} />}
            {canCreateContinuation(user, task, ledTeamMemberIds) && <ContinueTaskDialog task={task} />}
          </div>
        </Card>

        <TaskChain taskId={task._id} />

        {!task.parentTask && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-foreground">Subtasks</h2>
              {canCreateSubtask(user, task) && (
                <CreateSubtaskDialog
                  parentTaskId={task._id}
                  teamMemberIds={
                    task.team
                      ? [task.team.leader._id, ...task.team.members.map((m) => m._id)]
                      : undefined
                  }
                />
              )}
            </div>
            {subtasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subtasks yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {subtasks.map((subtask) => (
                  <TaskCard key={subtask._id} task={subtask} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
