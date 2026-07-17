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
import { Card } from '@/components/ui/card'
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
import { hasPermission } from '@/lib/permissions'
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
  ecoId: string
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
  workingHoursStart: string
  workingHoursEnd: string
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
    ecoId: employee.ecoId ?? '',
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
    workingHoursStart: employee.workingHoursStart ?? '09:30',
    workingHoursEnd: employee.workingHoursEnd ?? '18:30',
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
    <div className="border-b border-border/40 pb-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground mt-1 uppercase tracking-wide">{value || '—'}</p>
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
    <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-border/40 bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 rounded border-border accent-primary cursor-pointer"
      />
      <span className="text-sm font-bold uppercase tracking-wide text-foreground">{label}</span>
    </label>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useEmployee(id)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-4 bg-transparent">
        <Skeleton className="h-8 w-48 bg-secondary/40 rounded-xl" />
        <Skeleton className="h-64 w-full bg-secondary/40 rounded-xl" />
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
  const canGenerateDocs = hasPermission(user, 'generate_documents')
  const canRequestDocs = hasPermission(user, 'request_documents')
  const canAddCredentials = hasPermission(user, 'add_credentials')
  const canViewSalary = hasPermission(user, 'view_salary_slip')
  const canEditDetails = hasPermission(user, 'edit_employee_details')
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
        ecoId: values.ecoId || undefined,
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
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-4xl space-y-8">
        {/* HERO DETAIL HEADER */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 bg-transparent">
          {/* Identity Tile */}
          <Card className="md:col-span-2 p-8 flex flex-col justify-between min-h-[220px]">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">EMPLOYEE PROFILE</span>
              <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tighter text-foreground">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="font-mono text-base font-semibold text-muted-foreground mt-1 uppercase tracking-wider">{employee.employeeCode}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <StatusBadge status={employee.status} />
            </div>
          </Card>

          {/* Action Tiles */}
          <div className="flex flex-col gap-4">
            {/* Back Button */}
            <div
              onClick={() => navigate('/')}
              className="bg-primary/10 text-primary p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-[10px] font-bold tracking-widest text-primary/70 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO PORTAL</span>
            </div>

            {/* Generate Documents */}
            {canGenerateDocs && (
              <div
                onClick={() => navigate(`/employees/${employeeId}/wizard`)}
                className="bg-secondary text-secondary-foreground p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
              >
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">DOCUMENT SYSTEM</span>
                <span className="text-2xl font-extrabold uppercase tracking-wide">GENERATE DOCS</span>
              </div>
            )}

            {/* Request Documents */}
            {canRequestDocs && (
              <RequestDocumentsModal
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
                employeePhone={employee.phone}
                trigger={
                  <div
                    className="bg-secondary text-secondary-foreground p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
                  >
                    <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">HR COLLECTION</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">REQUEST FILES</span>
                  </div>
                }
              />
            )}

            {/* Add/Manage Credentials */}
            {canAddCredentials && (
              <CredentialsDialog
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
                trigger={
                  <div className="bg-purple-500/10 text-purple-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                    <span className="text-[10px] font-bold tracking-widest text-purple-700/70 uppercase">PLATFORM ACCESS</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">ADD CREDENTIALS</span>
                  </div>
                }
              />
            )}

            {/* Generate Salary Slip */}
            {canViewSalary && (
              <GenerateSalarySlipDialog
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
                trigger={
                  <div className="bg-emerald-500/10 text-emerald-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                    <span className="text-[10px] font-bold tracking-widest text-emerald-700/70 uppercase">PAYROLL</span>
                    <span className="text-2xl font-extrabold uppercase tracking-wide">GENERATE SALARY SLIP</span>
                  </div>
                }
              />
            )}
          </div>
        </div>

        {/* DETAILS FORM */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
        <fieldset disabled={!canEditDetails} className="contents">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Details */}
            <Card className="p-6 space-y-6">
              <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
                PERSONAL DETAILS
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">FIRST NAME</Label>
                  <Input id="firstName" {...register('firstName', { required: true })} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">LAST NAME</Label>
                  <Input id="lastName" {...register('lastName')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="personalEmail" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PERSONAL EMAIL</Label>
                  <Input id="personalEmail" type="email" {...register('personalEmail')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PHONE</Label>
                  <Input id="phone" {...register('phone')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="instagramId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">INSTAGRAM ID</Label>
                  <Input id="instagramId" {...register('instagramId')} className="uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dob" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DATE OF BIRTH</Label>
                    <Input id="dob" type="date" {...register('dob')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">BLOOD GROUP</Label>
                    <Controller
                      control={control}
                      name="bloodGroup"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="SELECT" />
                          </SelectTrigger>
                          <SelectContent>
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
            </Card>

            {/* Employment */}
            <Card className="p-6 space-y-6">
              <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
                EMPLOYMENT
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="designation" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DESIGNATION</Label>
                  <Input id="designation" {...register('designation', { required: true })} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="department" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DEPARTMENT</Label>
                  <Input id="department" {...register('department')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="reportingManager" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">REPORTING MANAGER</Label>
                  <Input id="reportingManager" {...register('reportingManager')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="workLocation" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">WORK LOCATION</Label>
                  <Input id="workLocation" {...register('workLocation')} className="uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="workingHoursStart" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SHIFT START</Label>
                    <Input id="workingHoursStart" type="time" {...register('workingHoursStart')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="workingHoursEnd" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SHIFT END</Label>
                    <Input id="workingHoursEnd" type="time" {...register('workingHoursEnd')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dateOfHiring" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DATE OF HIRING</Label>
                    <Input id="dateOfHiring" type="date" {...register('dateOfHiring')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="dateOfJoining" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">DATE OF JOINING</Label>
                    <Input id="dateOfJoining" type="date" {...register('dateOfJoining')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">EMPLOYMENT TYPE</Label>
                    <Controller
                      control={control}
                      name="employmentType"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
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
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">STATUS</Label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
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
            </Card>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
                PERMANENT ADDRESS
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <Textarea {...register('permanentAddress.line1')} placeholder="ADDRESS LINE 1" />
                <Input {...register('permanentAddress.line2')} placeholder="ADDRESS LINE 2" className="uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.city')} placeholder="CITY" className="uppercase" />
                  <Input {...register('permanentAddress.state')} placeholder="STATE" className="uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.pincode')} placeholder="PINCODE" />
                  <Input {...register('permanentAddress.country')} placeholder="COUNTRY" className="uppercase" />
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/15 pb-3 flex-wrap gap-2">
                <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground">
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
                  className="disabled:opacity-50"
                />
                <Input
                  {...register('localAddress.line2')}
                  placeholder="ADDRESS LINE 2"
                  disabled={sameAsPermanent}
                  value={sameAsPermanent ? permanentAddress?.line2 : undefined}
                  className="uppercase disabled:opacity-50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.city')}
                    placeholder="CITY"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.city : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.state')}
                    placeholder="STATE"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.state : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.pincode')}
                    placeholder="PINCODE"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.pincode : undefined}
                    className="disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.country')}
                    placeholder="COUNTRY"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.country : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Onboarding Checklist */}
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
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
          </Card>

          {/* Compensation & IDs — admin-only */}
          {isAdmin && (
            <Card className="p-6 space-y-6">
              <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
                COMPENSATION & IDENTIFICATION
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="grid gap-1.5">
                  <Label htmlFor="ecoId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">BIOMETRIC DEVICE PIN (ECO ID)</Label>
                  <Input id="ecoId" {...register('ecoId')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ctcAnnual" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ANNUAL CTC</Label>
                  <Input id="ctcAnnual" type="number" {...register('ctcAnnual')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="monthlyPay" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">MONTHLY PAY</Label>
                  <Input id="monthlyPay" type="number" {...register('monthlyPay')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="panNumber" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PAN NUMBER</Label>
                  <Input id="panNumber" {...register('panNumber')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aadharNumber" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AADHAR NUMBER</Label>
                  <Input id="aadharNumber" {...register('aadharNumber')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">BANK NAME</Label>
                  <Input id="bankName" {...register('bankName')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankAccountNumber" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">BANK A/C NUMBER</Label>
                  <Input id="bankAccountNumber" {...register('bankAccountNumber')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankIFSC" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">IFSC CODE</Label>
                  <Input id="bankIFSC" {...register('bankIFSC')} className="uppercase" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payDate" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PAY DATE (DAY OF MONTH)</Label>
                  <Input id="payDate" type="number" min="1" max="31" {...register('payDate')} />
                </div>
              </div>
            </Card>
          )}

          {/* Extra Details — freeform key/value pairs, like Render's env vars */}
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
              EXTRA DETAILS
            </h2>
            <div className="space-y-3">
              {extraDetails.fields.length === 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  No extra details yet. Add anything that doesn't have its own field below.
                </p>
              )}
              {extraDetails.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <Input
                    placeholder="KEY"
                    {...register(`extraDetails.${index}.key` as const)}
                    className="flex-1 font-mono uppercase"
                  />
                  <Input
                    placeholder="VALUE"
                    {...register(`extraDetails.${index}.value` as const)}
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => extraDetails.remove(index)}
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive rounded-xl p-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => extraDetails.append({ key: '', value: '' })}
              className="rounded-xl uppercase tracking-widest font-bold"
            >
              <Plus className="size-4" />
              Add Variable
            </Button>
          </Card>

        </fieldset>

          {/* Form Action Buttons — Save needs edit_employee_details, Delete stays admin-only */}
          {(canEditDetails || isAdmin) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canEditDetails && (
                <Button
                  type="submit"
                  disabled={updateEmployee.isPending}
                  className="bg-emerald-500/10 text-emerald-700 text-lg font-bold h-14 rounded-xl tracking-wider border-0 hover:bg-emerald-500/25 transition-all cursor-pointer shadow-none"
                >
                  {updateEmployee.isPending && <Loader2 className="size-5 animate-spin" />}
                  SAVE PROFILE CHANGES
                </Button>
              )}
              {isAdmin && (
                <Button
                  type="button"
                  onClick={onDelete}
                  disabled={deleteEmployee.isPending}
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 text-lg font-bold h-14 rounded-xl tracking-wider cursor-pointer"
                >
                  {deleteEmployee.isPending && <Loader2 className="size-5 animate-spin" />}
                  DELETE PROFILE
                </Button>
              )}
            </div>
          )}
        </form>

        {/* Recruitment Details — carried over from the application, only present on employees hired through the pipeline */}
        {employee.sourceApplicant && (
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest border-b border-border/15 pb-3 text-foreground">
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
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">RESUME FILE(S)</p>
                <div className="flex flex-wrap gap-3">
                  {employee.resumes.map((resume, i) => (
                    <a
                      key={i}
                      href={resume.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-secondary/50 px-4 text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-secondary transition-all"
                    >
                      {resume.originalFilename || `RESUME ${i + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="mt-8 grid gap-8">
          <AttendanceSummaryCard employeeId={employeeId} />
          {canViewSalary && (
            <SalarySlipsList employeeId={employeeId} employeeName={`${employee.firstName} ${employee.lastName ?? ''}`} />
          )}
          {canGenerateDocs && (
            <GeneratedDocumentsList
              employeeId={employeeId}
              employeeName={`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
              employeeEmail={employee.personalEmail}
              employeePhone={employee.phone}
            />
          )}
          {canRequestDocs && (
            <>
              <UploadedDocumentsList employeeId={employeeId} />
              <RequestHistoryTable
                employeeId={employeeId}
                employeeName={`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
                employeePhone={employee.phone}
              />
            </>
          )}
          <ActivityTimeline employeeId={employeeId} />
        </div>
      </main>
    </div>
  )
}
