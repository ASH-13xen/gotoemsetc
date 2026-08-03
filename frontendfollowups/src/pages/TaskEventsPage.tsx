import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { TaskEventFormDialog } from '@/components/events/TaskEventFormDialog'
import { useAuth } from '@/hooks/useAuth'
import { canManageTasks } from '@/lib/permissions'
import { useDeleteTaskEvent, useTaskEvents } from '@/hooks/useTaskEvents'

export default function TaskEventsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useTaskEvents()
  const deleteEvent = useDeleteTaskEvent()

  if (!canManageTasks(user)) return <Navigate to="/tasks" replace />

  const events = data?.events ?? []

  const onDelete = (id: string, name: string) => {
    if (!window.confirm(`Remove event "${name}"?`)) return
    deleteEvent.mutate(id, {
      onSuccess: () => toast.success('Event removed'),
      onError: () => toast.error('Could not remove event'),
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Events</h1>
          <TaskEventFormDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                Register Event
              </Button>
            }
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events registered yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <Card key={event._id} className="p-6">
                <CardHeader className="flex-row items-start justify-between px-0 pt-0">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    {event.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <TaskEventFormDialog event={event} trigger={<Button variant="outline" size="sm">Edit</Button>} />
                    <Button variant="ghost" size="icon" onClick={() => onDelete(event._id, event.name)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                {event.description && (
                  <CardContent className="px-0">
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
