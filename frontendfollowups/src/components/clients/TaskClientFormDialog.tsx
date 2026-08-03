import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateTaskClient, useUpdateTaskClient } from '@/hooks/useTaskClients'
import { useWorkTeams } from '@/hooks/useWorkTeams'
import type { TaskClient } from '@/api/taskClients.api'

type FormValues = { name: string; defaultTeam: string }
const NO_TEAM = '__none__'

export function TaskClientFormDialog({ client, trigger }: { client?: TaskClient; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(client)
  const { control, register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: client?.name ?? '', defaultTeam: client?.defaultTeam?._id ?? '' },
  })
  const { data: teamsData } = useWorkTeams()
  const createClient = useCreateTaskClient()
  const updateClient = useUpdateTaskClient(client?._id ?? '')
  const isPending = createClient.isPending || updateClient.isPending

  const onSubmit = (values: FormValues) => {
    const mutation = isEdit ? updateClient : createClient
    mutation.mutate(
      { name: values.name, defaultTeam: values.defaultTeam || null },
      {
        onSuccess: () => {
          toast.success(isEdit ? 'Client updated' : 'Client registered')
          setOpen(false)
          if (!isEdit) reset()
        },
        onError: () => toast.error('Could not save client'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Register Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Client Name</Label>
            <Input {...register('name', { required: true })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Default Team</Label>
            <Controller
              control={control}
              name="defaultTeam"
              render={({ field }) => (
                <Select value={field.value || NO_TEAM} onValueChange={(v) => field.onChange(v === NO_TEAM ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="SELECT TEAM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM}>— None —</SelectItem>
                    {(teamsData?.teams ?? []).map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-[10px] font-semibold text-muted-foreground">
              Auto-selected when a task is created for this client — still editable per task.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isEdit ? 'Save Changes' : 'Register Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
