import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { TaskCard } from '@/components/tasks/TaskCard'
import { useReviewTasks } from '@/hooks/useEmployeeTasks'

export default function ReviewTasksPage() {
  const { data, isLoading } = useReviewTasks()
  const tasks = data?.tasks ?? []
  const isReviewer = data?.isReviewer ?? false

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Review Tasks</h1>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
        ) : !isReviewer ? (
          <p className="text-sm text-muted-foreground">You don't manage any direct reports or lead any teams yet.</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing pending your sign-off right now.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
