import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useMarkCompleted, useMarkCompletedDirect, useMarkForReview } from '@/hooks/useEmployeeTasks'
import type { EmployeeTask } from '@/api/employeeTasks.api'

// Review-optional counterpart to MarkForReviewButton — the same person who
// would've marked it for review instead finishes it directly, no
// admin/leader sign-off step.
export function FinishTaskButton({ task }: { task: EmployeeTask }) {
  const markCompletedDirect = useMarkCompletedDirect(task._id)
  return (
    <Button
      disabled={markCompletedDirect.isPending}
      onClick={() =>
        markCompletedDirect.mutate(undefined, {
          onSuccess: () => toast.success('Task completed'),
          onError: () => toast.error('Could not complete task'),
        })
      }
    >
      Mark Completed
    </Button>
  )
}

export function MarkForReviewButton({ task }: { task: EmployeeTask }) {
  const markForReview = useMarkForReview(task._id)
  return (
    <Button
      disabled={markForReview.isPending}
      onClick={() =>
        markForReview.mutate(undefined, {
          onSuccess: () => toast.success('Marked for review'),
          onError: () => toast.error('Could not mark for review'),
        })
      }
    >
      Mark for Review
    </Button>
  )
}

export function CompleteTaskButton({ task }: { task: EmployeeTask }) {
  const markCompleted = useMarkCompleted(task._id)
  return (
    <Button
      variant="secondary"
      disabled={markCompleted.isPending}
      onClick={() =>
        markCompleted.mutate(undefined, {
          onSuccess: () => toast.success('Task marked completed'),
          onError: () => toast.error('Could not mark completed'),
        })
      }
    >
      Mark Completed
    </Button>
  )
}
