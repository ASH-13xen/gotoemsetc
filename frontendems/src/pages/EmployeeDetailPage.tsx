import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { CredentialsDialog } from '@/components/employees/CredentialsDialog'
import { GenerateSalarySlipDialog } from '@/components/salary/GenerateSalarySlipDialog'
import { SalarySlipsList } from '@/components/salary/SalarySlipsList'
import { RequestHistoryTable } from '@/components/uploadRequests/RequestHistoryTable'
import { ActivityTimeline } from '@/components/employees/ActivityTimeline'
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard'
import { useAuth } from '@/hooks/useAuth'
import { useDeleteEmployee, useEmployee, useUpdateEmployee } from '@/hooks/useEmployees'
import { BLOOD_GROUPS, type Address, type Employee, type EmployeeStatus, type EmploymentType } from '@/api/employees.api'

type AddressForm = {
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  country: string
}

type FormValues = {
  firstName: string
  lastName: string
  personalEmail: string
  phone: string
  instagramId: string
  permanentAddress: AddressForm
  localAddress: AddressForm
  dob: string
  bloodGroup: string
  designation: string
  department: string
  reportingManager: string
  workLocation: string
  dateOfJoining: string
  dateOfHiring: string
  employmentType: EmploymentType
  status: EmployeeStatus
  ctcAnnual: string
  monthlyPay: string
  panNumber: string
  aadharNumber: string
  bankName: string
  bankAccountNumber: string
  bankIFSC: string
  payDate: string
  biometricVerificationAdded: boolean
  companyLoginAdded: boolean
  officePhoneAdded: boolean
  personalPhoneAdded: boolean
  extraDetails: { key: string; value: string }[]
}

function toDateInputValue(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function toAddressForm(address: Address | undefined): AddressForm {
  return {
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    pincode: address?.pincode ?? '',
    country: address?.country ?? '',
  }
}

function addressesEqual(a: AddressForm, b: AddressForm): boolean {
  return a.line1 === b.line1 && a.line2 === b.line2 && a.city === b.city && a.state === b.state && a.pincode === b.pincode && a.country === b.country
}

function toFormValues(employee: Employee): FormValues {
  return {
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    personalEmail: employee.personalEmail ?? '',
    phone: employee.phone ?? '',
    instagramId: employee.instagramId ?? '',
    permanentAddress: toAddressForm(employee.permanentAddress),
    localAddress: toAddressForm(employee.localAddress),
    dob: toDateInputValue(employee.dob),
    bloodGroup: employee.bloodGroup ?? '',
    designation: employee.designation ?? '',
    department: employee.department ?? '',
    reportingManager: employee.reportingManager ?? '',
    workLocation: employee.workLocation ?? '',
    dateOfJoining: toDateInputValue(employee.dateOfJoining),
    dateOfHiring: toDateInputValue(employee.dateOfHiring),
    employmentType: employee.employmentType ?? 'full-time',
    status: employee.status ?? 'draft',
    ctcAnnual: employee.ctcAnnual != null ? String(employee.ctcAnnual) : '',
    monthlyPay: employee.monthlyPay != null ? String(employee.monthlyPay) : '',
    panNumber: employee.panNumber ?? '',
    aadharNumber: employee.aadharNumber ?? '',
    bankName: employee.bankName ?? '',
    bankAccountNumber: employee.bankAccountNumber ?? '',
    bankIFSC: employee.bankIFSC ?? '',
    payDate: employee.payDate != null ? String(employee.payDate) : '',
    biometricVerificationAdded: employee.biometricVerificationAdded ?? false,
    companyLoginAdded: employee.companyLoginAdded ?? false,
    officePhoneAdded: employee.officePhoneAdded ?? false,
    personalPhoneAdded: employee.personalPhoneAdded ?? false,
    extraDetails: (employee.extraDetails ?? []).map((d) => ({ key: d.key, value: d.value ?? '' })),
  }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b-2 border-neutral-900 pb-3">
      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="text-base font-bold text-white mt-1 uppercase tracking-wide">{value || '—'}</p>
    </div>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 border-2 border-white bg-neutral-900 accent-emerald-500 cursor-pointer"
      />
      <span className="text-sm font-bold uppercase tracking-wide text-white">{label}</span>
    </label>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useEmployee(id)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Keyed on the employee id so navigating between employees (or a refetch
  // replacing the object) always mounts a fresh form instance — this is what
  // guarantees useForm's defaultValues are correct on its very first render,
  // so controlled Selects are never mounted with an undefined value.
  return <EmployeeDetailForm key={data.employee._id} employee={data.employee} employeeId={id as string} />
}

function EmployeeDetailForm({ employee, employeeId }: { employee: Employee; employeeId: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const updateEmployee = useUpdateEmployee(employeeId)
  const deleteEmployee = useDeleteEmployee()

  const { register, handleSubmit, control, watch, setValue } = useForm<FormValues>({
    defaultValues: toFormValues(employee),
  })
  const extraDetails = useFieldArray({ control, name: 'extraDetails' })

  const permanentAddress = watch('permanentAddress')
  const [sameAsPermanent, setSameAsPermanent] = useState(() => addressesEqual(toFormValues(employee).permanentAddress, toFormValues(employee).localAddress))

  const onToggleSameAsPermanent = (checked: boolean) => {
    setSameAsPermanent(checked)
    if (checked) {
      setValue('localAddress', permanentAddress)
    }
  }

  const onSubmit = (values: FormValues) => {
    updateEmployee.mutate(
      {
        ...values,
        ctcAnnual: values.ctcAnnual ? Number(values.ctcAnnual) : undefined,
        monthlyPay: values.monthlyPay ? Number(values.monthlyPay) : undefined,
        payDate: values.payDate ? Number(values.payDate) : undefined,
        dob: values.dob || undefined,
        dateOfJoining: values.dateOfJoining || undefined,
        dateOfHiring: values.dateOfHiring || undefined,
        permanentAddress: values.permanentAddress,
        localAddress: sameAsPermanent ? values.permanentAddress : values.localAddress,
        extraDetails: values.extraDetails?.filter((d) => d.key.trim().length > 0),
      },
      {
        onSuccess: () => toast.success('Employee updated'),
        onError: () => toast.error('Could not save changes'),
      }
    )
  }

  const onDelete = () => {
    if (!window.confirm(`Remove ${employee.firstName}? This can't be undone from the UI.`)) return
    deleteEmployee.mutate(employeeId, {
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
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-white p-8 flex flex-col justify-between min-h-55">
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
              className="bg-primary text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO PORTAL</span>
            </div>

            {/* Generate Documents */}
            <div
              onClick={() => navigate(`/employees/${employeeId}/wizard`)}
              className="bg-blue-700 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">DOCUMENT SYSTEM</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">GENERATE DOCS</span>
            </div>

            {/* Request Documents */}
            <RequestDocumentsModal
              employeeId={employeeId}
              trigger={
                <div
                  className="bg-neutral-800 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25"
                >
                  <span className="text-xs font-black tracking-widest opacity-80 uppercase">HR COLLECTION</span>
                  <span className="text-2xl font-extrabold uppercase tracking-wide">REQUEST FILES</span>
                </div>
              }
            />

            {/* Add/Manage Credentials — admin-only */}
            {isAdmin && (
              <CredentialsDialog
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
                trigger={
                  <div className="bg-purple-800 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                    <span className="text-xs font-black tracking-widest opacity-80 uppercase">PLATFORM ACCESS</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">ADD CREDENTIALS</span>
                  </div>
                }
              />
            )}

            {/* Generate Salary Slip — admin-only */}
            {isAdmin && (
              <GenerateSalarySlipDialog
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
                trigger={
                  <div className="bg-emerald-800 text-white p-6 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-25">
                    <span className="text-xs font-black tracking-widest opacity-80 uppercase">PAYROLL</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">GENERATE SALARY SLIP</span>
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
                <div className="grid gap-1.5">
                  <Label htmlFor="instagramId" className="text-xs font-black uppercase tracking-widest text-neutral-400">INSTAGRAM ID</Label>
                  <Input id="instagramId" {...register('instagramId')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dob" className="text-xs font-black uppercase tracking-widest text-neutral-400">DATE OF BIRTH</Label>
                    <Input id="dob" type="date" {...register('dob')} className="bg-neutral-900 border-white text-white rounded-none" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400">BLOOD GROUP</Label>
                    <Controller
                      control={control}
                      name="bloodGroup"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-neutral-900 border-white text-white rounded-none">
                            <SelectValue placeholder="SELECT" />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-white text-white rounded-none">
                            {BLOOD_GROUPS.map((bg) => (
                              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
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
                    <Label htmlFor="dateOfHiring" className="text-xs font-black uppercase tracking-widest text-neutral-400">DATE OF HIRING</Label>
                    <Input id="dateOfHiring" type="date" {...register('dateOfHiring')} className="bg-neutral-900 border-white text-white rounded-none" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="dateOfJoining" className="text-xs font-black uppercase tracking-widest text-neutral-400">DATE OF JOINING</Label>
                    <Input id="dateOfJoining" type="date" {...register('dateOfJoining')} className="bg-neutral-900 border-white text-white rounded-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400">EMPLOYMENT TYPE</Label>
                    <Controller
                      control={control}
                      name="employmentType"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
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
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400">STATUS</Label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-neutral-900 border-white text-white rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-white text-white rounded-none">
                            <SelectItem value="draft">DRAFT</SelectItem>
                            <SelectItem value="active">ACTIVE</SelectItem>
                            <SelectItem value="offboarded">OFFBOARDED</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-white bg-black p-6 space-y-4">
              <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
                PERMANENT ADDRESS
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Textarea {...register('permanentAddress.line1')} placeholder="ADDRESS LINE 1" className="bg-neutral-900 border-white text-white rounded-none" />
                <Input {...register('permanentAddress.line2')} placeholder="ADDRESS LINE 2" className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.city')} placeholder="CITY" className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                  <Input {...register('permanentAddress.state')} placeholder="STATE" className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.pincode')} placeholder="PINCODE" className="bg-neutral-900 border-white text-white rounded-none" />
                  <Input {...register('permanentAddress.country')} placeholder="COUNTRY" className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
              </div>
            </div>

            <div className="border-2 border-white bg-black p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-white pb-3 flex-wrap gap-2">
                <h2 className="text-2xl font-black uppercase tracking-widest text-white">
                  LOCAL ADDRESS
                </h2>
                <CheckboxRow
                  label="SAME AS PERMANENT?"
                  checked={sameAsPermanent}
                  onChange={onToggleSameAsPermanent}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Textarea
                  {...register('localAddress.line1')}
                  placeholder="ADDRESS LINE 1"
                  disabled={sameAsPermanent}
                  value={sameAsPermanent ? permanentAddress?.line1 : undefined}
                  className="bg-neutral-900 border-white text-white rounded-none disabled:opacity-50"
                />
                <Input
                  {...register('localAddress.line2')}
                  placeholder="ADDRESS LINE 2"
                  disabled={sameAsPermanent}
                  value={sameAsPermanent ? permanentAddress?.line2 : undefined}
                  className="bg-neutral-900 border-white text-white rounded-none uppercase disabled:opacity-50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.city')}
                    placeholder="CITY"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.city : undefined}
                    className="bg-neutral-900 border-white text-white rounded-none uppercase disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.state')}
                    placeholder="STATE"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.state : undefined}
                    className="bg-neutral-900 border-white text-white rounded-none uppercase disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.pincode')}
                    placeholder="PINCODE"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.pincode : undefined}
                    className="bg-neutral-900 border-white text-white rounded-none disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.country')}
                    placeholder="COUNTRY"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.country : undefined}
                    className="bg-neutral-900 border-white text-white rounded-none uppercase disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Onboarding Checklist */}
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              ONBOARDING CHECKLIST
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller
                control={control}
                name="biometricVerificationAdded"
                render={({ field }) => (
                  <CheckboxRow label="BIOMETRIC VERIFICATION ADDED" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="companyLoginAdded"
                render={({ field }) => (
                  <CheckboxRow label={`GOTOFRIEND_${employee.employeeCode} LOG IN?`} checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="officePhoneAdded"
                render={({ field }) => (
                  <CheckboxRow label="GOTO OFFICE PHONE NUMBER ADDED?" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="personalPhoneAdded"
                render={({ field }) => (
                  <CheckboxRow label="GOTO PERSONAL PHONE NUMBER ADDED?" checked={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          {/* Compensation & IDs — admin-only */}
          {isAdmin && (
            <div className="border-2 border-white bg-black p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
                COMPENSATION & IDENTIFICATION
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="grid gap-1.5">
                  <Label htmlFor="ctcAnnual" className="text-xs font-black uppercase tracking-widest text-neutral-400">ANNUAL CTC</Label>
                  <Input id="ctcAnnual" type="number" {...register('ctcAnnual')} className="bg-neutral-900 border-white text-white rounded-none" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="monthlyPay" className="text-xs font-black uppercase tracking-widest text-neutral-400">MONTHLY PAY</Label>
                  <Input id="monthlyPay" type="number" {...register('monthlyPay')} className="bg-neutral-900 border-white text-white rounded-none" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="panNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400">PAN NUMBER</Label>
                  <Input id="panNumber" {...register('panNumber')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aadharNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400">AADHAR NUMBER</Label>
                  <Input id="aadharNumber" {...register('aadharNumber')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankName" className="text-xs font-black uppercase tracking-widest text-neutral-400">BANK NAME</Label>
                  <Input id="bankName" {...register('bankName')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankAccountNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400">BANK A/C NUMBER</Label>
                  <Input id="bankAccountNumber" {...register('bankAccountNumber')} className="bg-neutral-900 border-white text-white rounded-none" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankIFSC" className="text-xs font-black uppercase tracking-widest text-neutral-400">IFSC CODE</Label>
                  <Input id="bankIFSC" {...register('bankIFSC')} className="bg-neutral-900 border-white text-white rounded-none uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payDate" className="text-xs font-black uppercase tracking-widest text-neutral-400">PAY DATE (DAY OF MONTH)</Label>
                  <Input id="payDate" type="number" min="1" max="31" {...register('payDate')} className="bg-neutral-900 border-white text-white rounded-none" />
                </div>
              </div>
            </div>
          )}

          {/* Extra Details — freeform key/value pairs, like Render's env vars */}
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              EXTRA DETAILS
            </h2>
            <div className="space-y-3">
              {extraDetails.fields.length === 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                  No extra details yet. Add anything that doesn't have its own field below.
                </p>
              )}
              {extraDetails.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <Input
                    placeholder="KEY"
                    {...register(`extraDetails.${index}.key` as const)}
                    className="flex-1 bg-neutral-900 border-white font-mono text-white rounded-none uppercase placeholder:text-neutral-600"
                  />
                  <Input
                    placeholder="VALUE"
                    {...register(`extraDetails.${index}.value` as const)}
                    className="flex-1 bg-neutral-900 border-white font-mono text-white rounded-none placeholder:text-neutral-600"
                  />
                  <Button
                    type="button"
                    onClick={() => extraDetails.remove(index)}
                    className="h-12 w-12 shrink-0 bg-neutral-900 border-2 border-white text-white hover:bg-red-600 hover:border-red-600 rounded-none p-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              onClick={() => extraDetails.append({ key: '', value: '' })}
              className="bg-neutral-900 border-2 border-white text-white hover:bg-neutral-800 rounded-none uppercase tracking-widest font-bold"
            >
              <Plus className="size-4" />
              Add Variable
            </Button>
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

        {/* Recruitment Details — carried over from the application, only present on employees hired through the pipeline */}
        {employee.sourceApplicant && (
          <div className="border-2 border-white bg-black p-6 space-y-6">
            <h2 className="text-2xl font-black uppercase tracking-widest border-b-2 border-white pb-3 text-white">
              RECRUITMENT DETAILS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Experience" value={employee.experienceLevel} />
              <Field label="Availability at application" value={employee.availability} />
              <Field label="Own laptop?" value={employee.hasLaptop === undefined ? undefined : employee.hasLaptop ? 'Yes' : 'No'} />
              <Field label="Was willing to relocate?" value={employee.willingToRelocate === undefined ? undefined : employee.willingToRelocate ? 'Yes' : 'No'} />
              <Field label="How they found us" value={employee.howDidYouFindUs} />
              <Field label="Work style preference" value={employee.workStylePreference} />
              <Field label="Salary at time of application" value={employee.currentSalary} />
              <Field label="Expected salary" value={employee.expectedSalary} />
            </div>
            <div className="grid grid-cols-1 gap-6">
              <Field label="Why they wanted to join" value={employee.whyJoinCompany} />
              <Field label="Why they were hired" value={employee.whyHireYou} />
              <Field label="Why they were selected" value={employee.selectionNotes} />
            </div>
            {employee.resumes && employee.resumes.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">RESUME FILE(S)</p>
                <div className="flex flex-wrap gap-3">
                  {employee.resumes.map((resume, i) => (
                    <a
                      key={i}
                      href={resume.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center gap-2 border-2 border-white bg-transparent px-4 font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors"
                    >
                      {resume.originalFilename || `RESUME ${i + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-8">
          <AttendanceSummaryCard employeeId={employeeId} />
          {isAdmin && (
            <SalarySlipsList employeeId={employeeId} employeeName={`${employee.firstName} ${employee.lastName ?? ''}`} />
          )}
          <GeneratedDocumentsList employeeId={employeeId} />
          <UploadedDocumentsList employeeId={employeeId} />
          <RequestHistoryTable employeeId={employeeId} />
          <ActivityTimeline employeeId={employeeId} />
        </div>
      </main>
    </div>
  )
}
