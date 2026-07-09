import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Plus, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { POSITION_OPTIONS } from '@/api/applicants.api'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  instagramId: z.string().optional(),
  experienceLevel: z.enum(['fresher', '0-1', '1-2', '2-3', '3-4', '4+']).optional(),
  hasLaptop: z.enum(['true', 'false']).optional(),
  willingToRelocate: z.enum(['true', 'false']).optional(),
  positionAppliedFor: z.string().optional(),
  availability: z.enum(['immediately', '15_days', '30_days', '60_days']).optional(),
  howDidYouFindUs: z.string().optional(),
  whyJoinCompany: z.string().optional(),
  workStylePreference: z.enum(['alone', 'team']).optional(),
  whyHireYou: z.string().optional(),
  currentSalary: z.string().optional(),
  expectedSalary: z.string().optional(),
  dateApplied: z.string().min(1, 'Date applied is required'),
})

type FormValues = z.infer<typeof schema>

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

const defaultValues: FormValues = { firstName: '', dateApplied: todayValue() }

export function AddApplicantDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [resumes, setResumes] = useState<File[]>([])
  const navigate = useNavigate()
  const createApplicant = useCreateApplicant()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const onSubmit = (values: FormValues) => {
    createApplicant.mutate(
      {
        ...values,
        hasLaptop: values.hasLaptop === undefined ? undefined : values.hasLaptop === 'true',
        willingToRelocate:
          values.willingToRelocate === undefined ? undefined : values.willingToRelocate === 'true',
        resumes,
      },
      {
        onSuccess: ({ applicant }) => {
          toast.success(`${applicant.firstName} added to applicants`)
          reset(defaultValues)
          setResumes([])
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
          reset(defaultValues)
          setResumes([])
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
              <Label htmlFor="phone">WhatsApp number</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="instagramId">Instagram ID</Label>
              <Input id="instagramId" placeholder="NA" {...register('instagramId')} />
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
            <Label>Position applied for</Label>
            <Controller
              control={control}
              name="positionAppliedFor"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Experience</Label>
              <Controller
                control={control}
                name="experienceLevel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fresher">Fresher</SelectItem>
                      <SelectItem value="0-1">0-1 Year</SelectItem>
                      <SelectItem value="1-2">1-2 Year</SelectItem>
                      <SelectItem value="2-3">2-3 Year</SelectItem>
                      <SelectItem value="3-4">3-4 Year</SelectItem>
                      <SelectItem value="4+">4+ Years</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>When can they start?</Label>
              <Controller
                control={control}
                name="availability"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediately">Immediately</SelectItem>
                      <SelectItem value="15_days">15 days notice</SelectItem>
                      <SelectItem value="30_days">30 days notice</SelectItem>
                      <SelectItem value="60_days">60 days notice</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Has their own laptop?</Label>
              <Controller
                control={control}
                name="hasLaptop"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>From Raipur / willing to relocate?</Label>
              <Controller
                control={control}
                name="willingToRelocate"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>How did they find us?</Label>
              <Input placeholder="Instagram, LinkedIn, Friend…" {...register('howDidYouFindUs')} />
            </div>
            <div className="grid gap-1.5">
              <Label>Prefers working…</Label>
              <Controller
                control={control}
                name="workStylePreference"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alone">Alone</SelectItem>
                      <SelectItem value="team">In a team</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="currentSalary">Current salary</Label>
              <Input id="currentSalary" {...register('currentSalary')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expectedSalary">Expected salary</Label>
              <Input id="expectedSalary" {...register('expectedSalary')} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="whyJoinCompany">Why do they want to work with us?</Label>
            <Textarea id="whyJoinCompany" {...register('whyJoinCompany')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="whyHireYou">Why should we hire them?</Label>
            <Textarea id="whyHireYou" {...register('whyHireYou')} />
          </div>

          <div className="grid gap-1.5">
            <Label>Resume / CV</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
              <UploadCloud className="size-4 shrink-0" />
              <span className="truncate">
                {resumes.length ? `${resumes.length} file(s) selected` : 'Choose up to 5 files (PDF or Word)…'}
              </span>
              <input
                type="file"
                multiple
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => setResumes(Array.from(e.target.files ?? []).slice(0, 5))}
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
