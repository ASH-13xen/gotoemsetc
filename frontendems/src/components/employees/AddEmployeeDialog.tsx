import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
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
import { useCreateEmployee } from '@/hooks/useEmployees'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  designation: z.string().min(1, 'Designation is required'),
})

type FormValues = z.infer<typeof schema>

export function AddEmployeeDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const createEmployee = useCreateEmployee()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    createEmployee.mutate(values, {
      onSuccess: ({ employee }) => {
        toast.success(`${employee.firstName} added as a draft employee`)
        reset()
        setOpen(false)
        navigate(`/employees/${employee._id}`)
      },
      onError: () => toast.error('Could not create employee'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="size-4" />
            Add Employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Start with the basics — you can fill in everything else from the employee's
            page next.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" aria-invalid={Boolean(errors.firstName)} {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register('lastName')} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              placeholder="e.g. Software Engineer"
              aria-invalid={Boolean(errors.designation)}
              {...register('designation')}
            />
            {errors.designation && (
              <p className="text-xs text-destructive">{errors.designation.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createEmployee.isPending}>
              {createEmployee.isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
