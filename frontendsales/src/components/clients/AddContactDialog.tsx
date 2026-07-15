import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAddContact } from '@/hooks/useClients'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function AddContactDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const addContact = useAddContact(clientId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    addContact.mutate(values, {
      onSuccess: () => {
        toast.success('Contact added')
        reset()
        setOpen(false)
      },
      onError: () => toast.error('Could not add contact'),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-foreground bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Add Contact</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a contact person for this client.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Name
            </Label>
            <Input
              id="name"
              className="rounded-none border-2 border-foreground bg-background text-foreground"
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Role
            </Label>
            <Input id="role" className="rounded-none border-2 border-foreground bg-background text-foreground" {...register('role')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                className="rounded-none border-2 border-foreground bg-background text-foreground"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
                Phone
              </Label>
              <Input id="phone" className="rounded-none border-2 border-foreground bg-background text-foreground" {...register('phone')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={addContact.isPending}>
              {addContact.isPending && <Loader2 className="size-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
