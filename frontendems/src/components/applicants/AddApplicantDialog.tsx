import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Plus, UploadCloud } from 'lucide-react'

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
import { useCreateApplicant } from '@/hooks/useApplicants'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  positionAppliedFor: z.string().optional(),
  dateApplied: z.string().min(1, 'Date applied is required'),
})

type FormValues = z.infer<typeof schema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function AddApplicantDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [resume, setResume] = useState<File | null>(null)
  const navigate = useNavigate()
  const createApplicant = useCreateApplicant()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dateApplied: todayValue() },
  })

  const onSubmit = (values: FormValues) => {
    createApplicant.mutate(
      { ...values, resume: resume ?? undefined },
      {
        onSuccess: ({ applicant }) => {
          toast.success(`${applicant.firstName} added to applicants`)
          reset({ dateApplied: todayValue() })
          setResume(null)
          setOpen(false)
          navigate(`/applicants/${applicant._id}`)
        },
        onError: () => toast.error('Could not add applicant'),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          reset({ dateApplied: todayValue() })
          setResume(null)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="size-4" />
            Add Applicant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add applicant</DialogTitle>
          <DialogDescription>Store their details and resume for review.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" aria-invalid={Boolean(errors.firstName)} {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register('lastName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="positionAppliedFor">Position applied for</Label>
              <Input id="positionAppliedFor" {...register('positionAppliedFor')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dateApplied">Date applied</Label>
              <Input
                id="dateApplied"
                type="date"
                aria-invalid={Boolean(errors.dateApplied)}
                {...register('dateApplied')}
              />
              {errors.dateApplied && (
                <p className="text-xs text-destructive">{errors.dateApplied.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Resume / CV</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
              <UploadCloud className="size-4 shrink-0" />
              <span className="truncate">{resume?.name ?? 'Choose file (PDF or Word)…'}</span>
              <input
                type="file"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => setResume(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createApplicant.isPending}>
              {createApplicant.isPending && <Loader2 className="size-4 animate-spin" />}
              Add applicant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
