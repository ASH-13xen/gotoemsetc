import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/employees/StatusBadge'
import { GeneratedDocumentsList } from '@/components/documents/GeneratedDocumentsList'
import { UploadedDocumentsList } from '@/components/documents/UploadedDocumentsList'
import { RequestDocumentsModal } from '@/components/uploadRequests/RequestDocumentsModal'
import { RequestHistoryTable } from '@/components/uploadRequests/RequestHistoryTable'
import { ActivityTimeline } from '@/components/employees/ActivityTimeline'
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard'
import { useDeleteEmployee, useEmployee, useUpdateEmployee } from '@/hooks/useEmployees'
import type { Employee, EmployeeStatus, EmploymentType } from '@/api/employees.api'

type FormValues = {
  firstName: string
  lastName: string
  personalEmail: string
  phone: string
  designation: string
  department: string
  reportingManager: string
  workLocation: string
  employmentType: EmploymentType
  status: EmployeeStatus
  ctcAnnual: string
  panNumber: string
  aadharNumber: string
}

function toFormValues(employee: Employee): FormValues {
  return {
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    personalEmail: employee.personalEmail ?? '',
    phone: employee.phone ?? '',
    designation: employee.designation ?? '',
    department: employee.department ?? '',
    reportingManager: employee.reportingManager ?? '',
    workLocation: employee.workLocation ?? '',
    employmentType: employee.employmentType ?? 'full-time',
    status: employee.status ?? 'draft',
    ctcAnnual: employee.ctcAnnual != null ? String(employee.ctcAnnual) : '',
    panNumber: employee.panNumber ?? '',
    aadharNumber: employee.aadharNumber ?? '',
  }
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useEmployee(id)
  const updateEmployee = useUpdateEmployee(id ?? '')
  const deleteEmployee = useDeleteEmployee()

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>()

  useEffect(() => {
    if (data?.employee) reset(toFormValues(data.employee))
  }, [data, reset])

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { employee } = data

  const onSubmit = (values: FormValues) => {
    updateEmployee.mutate(
      {
        ...values,
        ctcAnnual: values.ctcAnnual ? Number(values.ctcAnnual) : undefined,
      },
      {
        onSuccess: () => toast.success('Employee updated'),
        onError: () => toast.error('Could not save changes'),
      }
    )
  }

  const onDelete = () => {
    if (!id) return
    if (!window.confirm(`Remove ${employee.firstName}? This can't be undone from the UI.`)) return
    deleteEmployee.mutate(id, {
      onSuccess: () => {
        toast.success('Employee removed')
        navigate('/')
      },
      onError: () => toast.error('Could not remove employee'),
    })
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* HERO DETAIL HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-white bg-black">
          {/* Identity Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-white p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">EMPLOYEE PROFILE</span>
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="font-mono text-base font-bold text-neutral-400 mt-1 uppercase tracking-wider">{employee.employeeCode}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <StatusBadge status={employee.status} />
            </div>
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 divide-y-2 divide-white">
            {/* Back Button */}
            <div
              onClick={() => navigate('/')}
              className="bg-primary text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO PORTAL</span>
            </div>

            {/* Generate Documents */}
            <div
              onClick={() => navigate(`/employees/${id}/wizard`)}
              className="bg-blue-700 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">DOCUMENT SYSTEM</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">GENERATE DOCS</span>
            </div>

            {/* Request Documents */}
            {id && (
              <RequestDocumentsModal
                employeeId={id}
                trigger={
                  <div
                    className="bg-neutral-800 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-[100px]"
                  >
                    <span className="text-xs font-black tracking-widest opacity-80 uppercase">HR COLLECTION</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">REQUEST FILES</span>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {/* DETAILS FORM */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Details */}
            <div className="border-2 border-white bg-black p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
                PERSONAL DETAILS
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="firstName" className="text-xs font-black uppercase tracking-widest text-neutral-400">FIRST NAME</Label>
                  <Input id="firstName" {...register('firstName', { required: true })} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lastName" className="text-xs font-black uppercase tracking-widest text-neutral-400">LAST NAME</Label>
                  <Input id="lastName" {...register('lastName')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="personalEmail" className="text-xs font-black uppercase tracking-widest text-neutral-400">PERSONAL EMAIL</Label>
                  <Input id="personalEmail" type="email" {...register('personalEmail')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-neutral-400">PHONE</Label>
                  <Input id="phone" {...register('phone')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
              </div>
            </div>

            {/* Employment */}
            <div className="border-2 border-white bg-black p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
                EMPLOYMENT
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="designation" className="text-xs font-black uppercase tracking-widest text-neutral-400">DESIGNATION</Label>
                  <Input id="designation" {...register('designation', { required: true })} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="department" className="text-xs font-black uppercase tracking-widest text-neutral-400">DEPARTMENT</Label>
                  <Input id="department" {...register('department')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="reportingManager" className="text-xs font-black uppercase tracking-widest text-neutral-400">REPORTING MANAGER</Label>
                  <Input id="reportingManager" {...register('reportingManager')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="workLocation" className="text-xs font-black uppercase tracking-widest text-neutral-400">WORK LOCATION</Label>
                  <Input id="workLocation" {...register('workLocation')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400">EMPLOYMENT TYPE</Label>
                    <Select
                      value={watch('employmentType')}
                      onValueChange={(v) => setValue('employmentType', v as EmploymentType)}
                    >
                      <SelectTrigger className="bg-neutral-900 border-white text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white text-white rounded-none">
                        <SelectItem value="full-time">FULL-TIME</SelectItem>
                        <SelectItem value="part-time">PART-TIME</SelectItem>
                        <SelectItem value="contract">CONTRACT</SelectItem>
                        <SelectItem value="intern">INTERN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400">STATUS</Label>
                    <Select
                      value={watch('status')}
                      onValueChange={(v) => setValue('status', v as EmployeeStatus)}
                    >
                      <SelectTrigger className="bg-neutral-900 border-white text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white text-white rounded-none">
                        <SelectItem value="draft">DRAFT</SelectItem>
                        <SelectItem value="active">ACTIVE</SelectItem>
                        <SelectItem value="offboarded">OFFBOARDED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compensation & IDs */}
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              COMPENSATION & IDENTIFICATION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="grid gap-1.5">
                <Label htmlFor="ctcAnnual" className="text-xs font-black uppercase tracking-widest text-neutral-400">ANNUAL CTC</Label>
                <Input id="ctcAnnual" type="number" {...register('ctcAnnual')} className="bg-neutral-900 border-white text-white rounded-none" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="panNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400">PAN NUMBER</Label>
                <Input id="panNumber" {...register('panNumber')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aadharNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400">AADHAR NUMBER</Label>
                <Input id="aadharNumber" {...register('aadharNumber')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              type="submit"
              disabled={updateEmployee.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-extrabold h-16 rounded-none tracking-widest border-none"
            >
              {updateEmployee.isPending && <Loader2 className="size-5 animate-spin" />}
              SAVE PROFILE CHANGES
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              disabled={deleteEmployee.isPending}
              className="bg-red-600 hover:bg-red-500 text-white text-xl font-extrabold h-16 rounded-none tracking-widest border-none"
            >
              {deleteEmployee.isPending && <Loader2 className="size-5 animate-spin" />}
              DELETE PROFILE
            </Button>
          </div>
        </form>

        {id && (
          <div className="mt-8 grid gap-8">
            <AttendanceSummaryCard employeeId={id} />
            <GeneratedDocumentsList employeeId={id} />
            <UploadedDocumentsList employeeId={id} />
            <RequestHistoryTable employeeId={id} />
            <ActivityTimeline employeeId={id} />
          </div>
        )}
      </main>
    </div>
  )
}
