import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
import { useRegisterClient } from '@/hooks/useClients'

const schema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  brandName: z.string().min(1, 'Brand name is required'),
  dateRegistered: z.string().min(1, 'Date is required'),
})

type FormValues = z.infer<typeof schema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function RegisterClientDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const registerClient = useRegisterClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dateRegistered: todayValue() },
  })

  const onSubmit = (values: FormValues) => {
    registerClient.mutate(values, {
      onSuccess: ({ client }) => {
        toast.success(`${client.clientName} registered`)
        reset({ dateRegistered: todayValue() })
        setOpen(false)
        navigate(`/clients/${client._id}`)
      },
      onError: () => toast.error('Could not register client'),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset({ dateRegistered: todayValue() })
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button>Register Client</Button>}
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-foreground bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Register Client</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Start tracking a new potential client.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="clientName" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Client Name
            </Label>
            <Input
              id="clientName"
              className="rounded-none border-2 border-foreground bg-background text-foreground"
              aria-invalid={Boolean(errors.clientName)}
              {...register('clientName')}
            />
            {errors.clientName && <p className="text-xs text-destructive">{errors.clientName.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="brandName" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Brand Name
            </Label>
            <Input
              id="brandName"
              className="rounded-none border-2 border-foreground bg-background text-foreground"
              aria-invalid={Boolean(errors.brandName)}
              {...register('brandName')}
            />
            {errors.brandName && <p className="text-xs text-destructive">{errors.brandName.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dateRegistered" className="text-xs font-black tracking-widest text-muted-foreground uppercase">
              Date Registered
            </Label>
            <Input
              id="dateRegistered"
              type="date"
              className="rounded-none border-2 border-foreground bg-background text-foreground"
              aria-invalid={Boolean(errors.dateRegistered)}
              {...register('dateRegistered')}
            />
            {errors.dateRegistered && (
              <p className="text-xs text-destructive">{errors.dateRegistered.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={registerClient.isPending}>
              {registerClient.isPending && <Loader2 className="size-4 animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
