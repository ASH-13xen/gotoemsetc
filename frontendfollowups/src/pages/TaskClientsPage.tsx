import { useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { TaskClientFormDialog } from '@/components/clients/TaskClientFormDialog'
import { useAuth } from '@/hooks/useAuth'
import { canManageTasks } from '@/lib/permissions'
import { useDeleteTaskClient, useTaskClients, useUploadTaskClientLogo } from '@/hooks/useTaskClients'
import type { TaskClient } from '@/api/taskClients.api'

function ClientCard({ client }: { client: TaskClient }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadLogo = useUploadTaskClientLogo(client._id)
  const deleteClient = useDeleteTaskClient()

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadLogo.mutate(file, {
      onSuccess: () => toast.success('Logo updated'),
      onError: () => toast.error('Could not upload logo'),
    })
    e.target.value = ''
  }

  const onDelete = () => {
    if (!window.confirm(`Remove client "${client.name}"?`)) return
    deleteClient.mutate(client._id, {
      onSuccess: () => toast.success('Client removed'),
      onError: () => toast.error('Could not remove client'),
    })
  }

  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="group relative flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-secondary/50"
        title="Change logo"
      >
        {client.logoUrl ? (
          <img src={client.logoUrl} alt={client.name} className="size-full object-cover" />
        ) : (
          <Building2 className="size-8 text-muted-foreground" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Upload className="size-5 text-white" />
        </span>
      </button>
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
      <p className="text-sm font-extrabold uppercase tracking-wide text-foreground">{client.name}</p>
      <div className="flex gap-1">
        <TaskClientFormDialog client={client} trigger={<Button variant="outline" size="sm">Edit</Button>} />
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </Card>
  )
}

export default function TaskClientsPage() {
  const { user } = useAuth()
  const { data, isLoading } = useTaskClients()

  if (!canManageTasks(user)) return <Navigate to="/tasks" replace />

  const clients = data?.clients ?? []

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Clients</h1>
          <TaskClientFormDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                Register Client
              </Button>
            }
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients registered yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {clients.map((client) => (
              <ClientCard key={client._id} client={client} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
