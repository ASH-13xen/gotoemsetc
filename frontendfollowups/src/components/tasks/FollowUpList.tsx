import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { useToggleFollowUp } from '@/hooks/useEmployeeTasks'
import { canToggleFollowUp } from '@/lib/taskAccess'
import type { EmployeeTask } from '@/api/employeeTasks.api'

export function FollowUpList({ task }: { task: EmployeeTask }) {
  const { user } = useAuth()
  const toggle = useToggleFollowUp(task._id)
  const canToggle = canToggleFollowUp(user, task)

  if (task.followUps.length === 0) {
    return <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
  }

  return (
    <div className="space-y-2">
      {task.followUps.map((followUp) => (
        <label key={followUp._id} className="flex items-start gap-3 rounded-xl bg-secondary/30 p-3">
          <Checkbox
            checked={followUp.isDone}
            disabled={!canToggle}
            onCheckedChange={(checked) => toggle.mutate({ followUpId: followUp._id, isDone: Boolean(checked) })}
          />
          <div className="flex-1">
            <p
              className={
                followUp.isDone ? 'text-sm text-muted-foreground line-through' : 'text-sm font-semibold text-foreground'
              }
            >
              {followUp.note || 'Follow-up'}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(followUp.followUpAt).toLocaleString('en-IN')}</p>
          </div>
        </label>
      ))}
    </div>
  )
}
