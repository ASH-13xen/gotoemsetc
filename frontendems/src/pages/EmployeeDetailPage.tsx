import { useState, type ReactNode } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, KeyRound, Loader2, Plus, Send, Trash2, Wallet } from 'lucide-react'

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
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'
import { StatusBadge } from '@/components/employees/StatusBadge'
import { GeneratedDocumentsList } from '@/components/documents/GeneratedDocumentsList'
import { UploadedDocumentsList } from '@/components/documents/UploadedDocumentsList'
import { UploadedDocumentImage } from '@/components/documents/UploadedDocumentImage'
import { RequestDocumentsModal } from '@/components/uploadRequests/RequestDocumentsModal'
import { CredentialsDialog } from '@/components/employees/CredentialsDialog'
import { FlagStrip, EmployeeFlagsManager } from '@/components/employees/EmployeeFlags'
import { GenerateSalarySlipDialog } from '@/components/salary/GenerateSalarySlipDialog'
import { SalarySlipsList } from '@/components/salary/SalarySlipsList'
import { RequestHistoryTable } from '@/components/uploadRequests/RequestHistoryTable'
import { ActivityTimeline } from '@/components/employees/ActivityTimeline'
import { AttendanceSummaryCard } from '@/components/attendance/AttendanceSummaryCard'
import { NotInformedWarningsCard } from '@/components/attendance/NotInformedWarningsCard'
import { PendingWarningsModal } from '@/components/attendance/PendingWarningsModal'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { extractApiErrorMessage } from '@/lib/errors'
import { hasAnyPermission, hasPermission, isAdminLike } from '@/lib/permissions'
import { useDeleteEmployee, useEmployee, useEmployees, useUpdateEmployee } from '@/hooks/useEmployees'
import { useUploadedDocuments } from '@/hooks/useUploadRequests'
import { BLOOD_GROUPS, type Address, type Employee, type EmployeeStatus, type EmploymentType, type Inventory } from '@/api/employees.api'

type InventoryForm = {
  deviceName: string
  imeiOrSerialNumber: string
  deviceColor: string
  simProvider: string
  simPhoneNumber: string
  screenGuard: boolean
  backCover: boolean
  powerAdapter: boolean
  cable: boolean
}

type AddressForm = {
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  country: string
}

type FormValues = {
  employeeCode: string
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
  manager: string
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
  assetAccessAdded: boolean
  updatedIn12345: boolean
  endDate: string
  reasonForLeaving: string
  removedFromGroupsAndReels: boolean
  mailDeactivated: boolean
  extraDetails: { key: string; value: string }[]
  inventory: InventoryForm
}

const NO_MANAGER = '__none__'

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

function toInventoryForm(inventory: Inventory | undefined): InventoryForm {
  return {
    deviceName: inventory?.deviceName ?? '',
    imeiOrSerialNumber: inventory?.imeiOrSerialNumber ?? '',
    deviceColor: inventory?.deviceColor ?? '',
    simProvider: inventory?.simProvider ?? '',
    simPhoneNumber: inventory?.simPhoneNumber ?? '',
    screenGuard: inventory?.screenGuard ?? false,
    backCover: inventory?.backCover ?? false,
    powerAdapter: inventory?.powerAdapter ?? false,
    cable: inventory?.cable ?? false,
  }
}

function toFormValues(employee: Employee): FormValues {
  return {
    employeeCode: employee.employeeCode ?? '',
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
    manager: typeof employee.manager === 'object' && employee.manager ? employee.manager._id : (employee.manager ?? ''),
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
    assetAccessAdded: employee.assetAccessAdded ?? false,
    updatedIn12345: employee.updatedIn12345 ?? false,
    endDate: toDateInputValue(employee.endDate),
    reasonForLeaving: employee.reasonForLeaving ?? '',
    removedFromGroupsAndReels: employee.removedFromGroupsAndReels ?? false,
    mailDeactivated: employee.mailDeactivated ?? false,
    extraDetails: (employee.extraDetails ?? []).map((d) => ({ key: d.key, value: d.value ?? '' })),
    inventory: toInventoryForm(employee.inventory),
  }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="border-b border-border pb-3 text-base font-semibold text-foreground">{children}</h2>
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
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 transition-colors select-none hover:bg-secondary/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded border-border accent-primary"
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useEmployee(id)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
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
  const isAdmin = isAdminLike(user)
  // A plain employee with no granted permissions always lands back on this
  // exact page (see frontendems/App.tsx's Home()), so "Back to Portal"
  // would just loop them right back here — only worth showing to someone
  // who actually has somewhere else to go.
  const canBackToPortal = hasAnyPermission(user)
  const canGenerateDocs = hasPermission(user, 'generate_documents')
  const canRequestDocs = hasPermission(user, 'request_documents')
  const canAddCredentials = hasPermission(user, 'add_credentials')
  const canViewSalary = hasPermission(user, 'view_salary_slip')
  const { data: uploadedDocsData } = useUploadedDocuments(employeeId)
  const photoDoc = uploadedDocsData?.uploadedDocuments.find((d) => d.docType === 'photo')
  const canEditDetails = hasPermission(user, 'edit_employee_details')
  const isOwnRecord = user?.employeeLink === employeeId
  const updateEmployee = useUpdateEmployee(employeeId)
  const deleteEmployee = useDeleteEmployee()

  const { register, handleSubmit, control, watch, setValue } = useForm<FormValues>({
    defaultValues: toFormValues(employee),
  })
  const extraDetails = useFieldArray({ control, name: 'extraDetails' })
  // For the Manager picker below — active roster minus this employee
  // themself (can't be their own manager).
  const { data: managerOptionsData } = useEmployees({ status: 'active', limit: 100 })
  const managerOptions = (managerOptionsData?.items ?? []).filter((e) => e._id !== employeeId)

  const permanentAddress = watch('permanentAddress')
  const status = watch('status')
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
        employeeCode: values.employeeCode || undefined,
        ctcAnnual: values.ctcAnnual ? Number(values.ctcAnnual) : undefined,
        monthlyPay: values.monthlyPay ? Number(values.monthlyPay) : undefined,
        payDate: values.payDate ? Number(values.payDate) : undefined,
        dob: values.dob || undefined,
        dateOfJoining: values.dateOfJoining || undefined,
        dateOfHiring: values.dateOfHiring || undefined,
        endDate: values.endDate || undefined,
        manager: values.manager || null,
        permanentAddress: values.permanentAddress,
        localAddress: sameAsPermanent ? values.permanentAddress : values.localAddress,
        extraDetails: values.extraDetails?.filter((d) => d.key.trim().length > 0),
      },
      {
        onSuccess: () => toast.success('Employee updated'),
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not save changes')),
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
      onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not remove employee')),
    })
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      {isOwnRecord && <PendingWarningsModal employeeId={employeeId} />}

      {/* PROFILE HEADER — the passport photo (once one's on file, see
          requested documents) renders as a fixed-size portrait beside the
          name, not a background — same layout for both an admin/HR viewer
          and the employee viewing their own profile. */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          {photoDoc && (
            <UploadedDocumentImage
              documentId={photoDoc._id}
              alt={`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
              className="h-28 w-20 shrink-0 rounded-lg border border-border object-cover"
            />
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Employee profile</span>
            <h1 className="text-3xl font-semibold uppercase tracking-tight text-foreground sm:text-4xl">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{employee.employeeCode}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <StatusBadge status={employee.status} />
              <FlagStrip flags={employee.flags ?? []} />
              {isAdmin && <EmployeeFlagsManager employeeId={employeeId} flags={employee.flags ?? []} />}
            </div>
          </div>
        </div>
        {canBackToPortal && (
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        )}
      </div>

      <QuickActions>
        {canGenerateDocs && (
          <QuickActionItem
            icon={<FileText className="size-4" />}
            label="Generate docs"
            description="Document system"
            onClick={() => navigate(`/employees/${employeeId}/wizard`)}
          />
        )}
        {canRequestDocs && (
          <RequestDocumentsModal
            employeeId={employeeId}
            employeeName={`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
            employeePhone={employee.phone}
            trigger={<QuickActionItem icon={<Send className="size-4" />} label="Request files" description="HR collection" />}
          />
        )}
        {canAddCredentials && (
          <CredentialsDialog
            employeeId={employeeId}
            employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
            trigger={<QuickActionItem icon={<KeyRound className="size-4" />} label="Add credentials" description="Platform access" />}
          />
        )}
        {canViewSalary && (
          <GenerateSalarySlipDialog
            employeeId={employeeId}
            employeeName={`${employee.firstName} ${employee.lastName ?? ''}`}
            trigger={<QuickActionItem icon={<Wallet className="size-4" />} label="Generate salary slip" description="Payroll" />}
          />
        )}
      </QuickActions>

      {/* DETAILS FORM */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
        <fieldset disabled={!canEditDetails} className="contents">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Personal Details */}
            <Card className="gap-6 p-6">
              <SectionTitle>Personal details</SectionTitle>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="firstName" className="text-xs text-muted-foreground">First name</Label>
                  <Input id="firstName" className="uppercase" {...register('firstName', { required: true })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lastName" className="text-xs text-muted-foreground">Last name</Label>
                  <Input id="lastName" className="uppercase" {...register('lastName')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="personalEmail" className="text-xs text-muted-foreground">Personal email</Label>
                  <Input id="personalEmail" type="email" {...register('personalEmail')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
                  <Input id="phone" {...register('phone')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="instagramId" className="text-xs text-muted-foreground">Instagram ID</Label>
                  <Input id="instagramId" className="uppercase" {...register('instagramId')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dob" className="text-xs text-muted-foreground">Date of birth</Label>
                    <Input id="dob" type="date" {...register('dob')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Blood group</Label>
                    <Controller
                      control={control}
                      name="bloodGroup"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
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
            <Card className="gap-6 p-6">
              <SectionTitle>Employment</SectionTitle>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="designation" className="text-xs text-muted-foreground">Designation</Label>
                  <Input id="designation" className="uppercase" {...register('designation', { required: true })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="department" className="text-xs text-muted-foreground">Department</Label>
                  <Input id="department" className="uppercase" {...register('department')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="reportingManager" className="text-xs text-muted-foreground">Reporting manager</Label>
                  <Input id="reportingManager" className="uppercase" {...register('reportingManager')} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Manager (task management)</Label>
                  <Controller
                    control={control}
                    name="manager"
                    render={({ field }) => (
                      <Select
                        value={field.value || NO_MANAGER}
                        onValueChange={(value) => field.onChange(value === NO_MANAGER ? '' : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_MANAGER}>— None —</SelectItem>
                          {managerOptions.map((option) => (
                            <SelectItem key={option._id} value={option._id}>
                              {`${option.firstName} ${option.lastName ?? ''}`.trim().toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="workLocation" className="text-xs text-muted-foreground">Work location</Label>
                  <Input id="workLocation" className="uppercase" {...register('workLocation')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="workingHoursStart" className="text-xs text-muted-foreground">Shift start</Label>
                    <Input id="workingHoursStart" type="time" {...register('workingHoursStart')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="workingHoursEnd" className="text-xs text-muted-foreground">Shift end</Label>
                    <Input id="workingHoursEnd" type="time" {...register('workingHoursEnd')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dateOfHiring" className="text-xs text-muted-foreground">Date of hiring</Label>
                    <Input id="dateOfHiring" type="date" {...register('dateOfHiring')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="dateOfJoining" className="text-xs text-muted-foreground">Date of joining</Label>
                    <Input id="dateOfJoining" type="date" {...register('dateOfJoining')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Employment type</Label>
                    <Controller
                      control={control}
                      name="employmentType"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="part-time">Part-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="offboarded">Offboarded</SelectItem>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="gap-4 p-6">
              <SectionTitle>Permanent address</SectionTitle>
              <div className="grid grid-cols-1 gap-4">
                <Textarea {...register('permanentAddress.line1')} placeholder="Address line 1" className="uppercase" />
                <Input {...register('permanentAddress.line2')} placeholder="Address line 2" className="uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.city')} placeholder="City" className="uppercase" />
                  <Input {...register('permanentAddress.state')} placeholder="State" className="uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input {...register('permanentAddress.pincode')} placeholder="Pincode" />
                  <Input {...register('permanentAddress.country')} placeholder="Country" className="uppercase" />
                </div>
              </div>
            </Card>

            <Card className="gap-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <h2 className="text-base font-semibold text-foreground">Local address</h2>
                <CheckboxRow label="Same as permanent?" checked={sameAsPermanent} onChange={onToggleSameAsPermanent} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Textarea
                  {...register('localAddress.line1')}
                  placeholder="Address line 1"
                  disabled={sameAsPermanent}
                  value={sameAsPermanent ? permanentAddress?.line1 : undefined}
                  className="uppercase disabled:opacity-50"
                />
                <Input
                  {...register('localAddress.line2')}
                  placeholder="Address line 2"
                  disabled={sameAsPermanent}
                  value={sameAsPermanent ? permanentAddress?.line2 : undefined}
                  className="uppercase disabled:opacity-50"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.city')}
                    placeholder="City"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.city : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.state')}
                    placeholder="State"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.state : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    {...register('localAddress.pincode')}
                    placeholder="Pincode"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.pincode : undefined}
                    className="disabled:opacity-50"
                  />
                  <Input
                    {...register('localAddress.country')}
                    placeholder="Country"
                    disabled={sameAsPermanent}
                    value={sameAsPermanent ? permanentAddress?.country : undefined}
                    className="uppercase disabled:opacity-50"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Onboarding Checklist */}
          <Card className="gap-6 p-6">
            <SectionTitle>Onboarding checklist</SectionTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Controller
                control={control}
                name="biometricVerificationAdded"
                render={({ field }) => (
                  <CheckboxRow label="Biometric verification added" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="companyLoginAdded"
                render={({ field }) => (
                  <CheckboxRow label={`Gotofriend_${employee.employeeCode} log in?`} checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="officePhoneAdded"
                render={({ field }) => (
                  <CheckboxRow label="Goto office phone number added?" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="personalPhoneAdded"
                render={({ field }) => (
                  <CheckboxRow label="Goto personal phone number added?" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="assetAccessAdded"
                render={({ field }) => (
                  <CheckboxRow label="Access of asset (mails + grps) added?" checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="updatedIn12345"
                render={({ field }) => (
                  <CheckboxRow label="Updated in 12345?" checked={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </Card>

          {/* Inventory — company-issued hardware/SIM, auto-fills the
              Hardware Consent Form's Equipment Inventory section in the
              document wizard the same way Designation/Department do. */}
          <Card className="gap-6 p-6">
            <SectionTitle>Inventory</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="inventory.deviceName" className="text-xs text-muted-foreground">Mobile/laptop name</Label>
                <Input id="inventory.deviceName" className="uppercase" {...register('inventory.deviceName')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inventory.imeiOrSerialNumber" className="text-xs text-muted-foreground">Mobile IMEI num / laptop serial num</Label>
                <Input id="inventory.imeiOrSerialNumber" className="uppercase" {...register('inventory.imeiOrSerialNumber')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inventory.deviceColor" className="text-xs text-muted-foreground">Mobile/laptop color</Label>
                <Input id="inventory.deviceColor" className="uppercase" {...register('inventory.deviceColor')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inventory.simProvider" className="text-xs text-muted-foreground">SIM provider</Label>
                <Input id="inventory.simProvider" className="uppercase" {...register('inventory.simProvider')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inventory.simPhoneNumber" className="text-xs text-muted-foreground">Phone number</Label>
                <Input id="inventory.simPhoneNumber" {...register('inventory.simPhoneNumber')} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Controller
                control={control}
                name="inventory.screenGuard"
                render={({ field }) => <CheckboxRow label="Screen guard" checked={field.value} onChange={field.onChange} />}
              />
              <Controller
                control={control}
                name="inventory.backCover"
                render={({ field }) => <CheckboxRow label="Back cover" checked={field.value} onChange={field.onChange} />}
              />
              <Controller
                control={control}
                name="inventory.powerAdapter"
                render={({ field }) => <CheckboxRow label="Power adapter" checked={field.value} onChange={field.onChange} />}
              />
              <Controller
                control={control}
                name="inventory.cable"
                render={({ field }) => <CheckboxRow label="Cable" checked={field.value} onChange={field.onChange} />}
              />
            </div>
          </Card>

          {/* Offboarding — only meaningful once status is set to Offboarded */}
          {status === 'offboarded' && (
            <Card className="gap-6 p-6">
              <SectionTitle>Offboarding</SectionTitle>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground">End date</Label>
                  <Input id="endDate" type="date" {...register('endDate')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="reasonForLeaving" className="text-xs text-muted-foreground">Reason for leaving</Label>
                  <Input id="reasonForLeaving" className="uppercase" {...register('reasonForLeaving')} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Controller
                  control={control}
                  name="removedFromGroupsAndReels"
                  render={({ field }) => (
                    <CheckboxRow label="Removed from groups + Go-To Reels" checked={field.value} onChange={field.onChange} />
                  )}
                />
                <Controller
                  control={control}
                  name="mailDeactivated"
                  render={({ field }) => <CheckboxRow label="Mail deactivated" checked={field.value} onChange={field.onChange} />}
                />
              </div>
            </Card>
          )}

          {/* Compensation & IDs — admin-only */}
          {isAdmin && (
            <Card className="gap-6 p-6">
              <SectionTitle>Compensation & identification</SectionTitle>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="employeeCode" className="text-xs text-muted-foreground">Code (biometric device PIN)</Label>
                  <Input id="employeeCode" className="uppercase" {...register('employeeCode')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ctcAnnual" className="text-xs text-muted-foreground">Annual CTC</Label>
                  <Input id="ctcAnnual" type="number" {...register('ctcAnnual')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="monthlyPay" className="text-xs text-muted-foreground">Monthly pay</Label>
                  <Input id="monthlyPay" type="number" {...register('monthlyPay')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="panNumber" className="text-xs text-muted-foreground">PAN number</Label>
                  <Input id="panNumber" className="uppercase" {...register('panNumber')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="aadharNumber" className="text-xs text-muted-foreground">Aadhar number</Label>
                  <Input id="aadharNumber" {...register('aadharNumber')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankName" className="text-xs text-muted-foreground">Bank name</Label>
                  <Input id="bankName" className="uppercase" {...register('bankName')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankAccountNumber" className="text-xs text-muted-foreground">Bank A/C number</Label>
                  <Input id="bankAccountNumber" {...register('bankAccountNumber')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bankIFSC" className="text-xs text-muted-foreground">IFSC code</Label>
                  <Input id="bankIFSC" className="uppercase" {...register('bankIFSC')} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payDate" className="text-xs text-muted-foreground">Pay date (day of month)</Label>
                  <Input id="payDate" type="number" min="1" max="31" {...register('payDate')} />
                </div>
              </div>
            </Card>
          )}

          {/* Extra Details — freeform key/value pairs, like Render's env vars */}
          <Card className="gap-6 p-6">
            <SectionTitle>Extra details</SectionTitle>
            <div className="space-y-3">
              {extraDetails.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No extra details yet. Add anything that doesn't have its own field below.
                </p>
              )}
              {extraDetails.fields.map((field, index) => {
                // Mirrors backend/src/utils/extraDetailsCrypto.js#isPasswordKey
                // exactly — a password-like value stays normal-case here the
                // same way it stays out of the uppercase sweep everywhere else.
                const isPasswordKey = /password/i.test(watch(`extraDetails.${index}.key`) || '')
                return (
                  <div key={field.id} className="flex items-center gap-3">
                    <Input
                      placeholder="Key"
                      {...register(`extraDetails.${index}.key` as const)}
                      className="flex-1 font-mono uppercase"
                    />
                    <Input
                      placeholder="Value"
                      {...register(`extraDetails.${index}.value` as const)}
                      className={cn('flex-1 font-mono', !isPasswordKey && 'uppercase')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => extraDetails.remove(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
            <Button type="button" variant="outline" onClick={() => extraDetails.append({ key: '', value: '' })}>
              <Plus className="size-4" />
              Add variable
            </Button>
          </Card>
        </fieldset>

        {/* Form Action Buttons — Save needs edit_employee_details, Delete stays admin-only */}
        {(canEditDetails || isAdmin) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {canEditDetails && (
              <Button type="submit" size="lg" disabled={updateEmployee.isPending}>
                {updateEmployee.isPending && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            )}
            {isAdmin && (
              <Button type="button" size="lg" variant="destructive" onClick={onDelete} disabled={deleteEmployee.isPending}>
                {deleteEmployee.isPending && <Loader2 className="size-4 animate-spin" />}
                Delete employee
              </Button>
            )}
          </div>
        )}
      </form>

      {/* Recruitment Details — carried over from the application, only present on employees hired through the pipeline */}
      {employee.sourceApplicant && (
        <Card className="gap-6 p-6">
          <SectionTitle>Recruitment details</SectionTitle>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              <p className="mb-2 text-xs text-muted-foreground">Resume file(s)</p>
              <div className="flex flex-wrap gap-2">
                {employee.resumes.map((resume, i) => (
                  <a
                    key={i}
                    href={resume.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70"
                  >
                    {resume.originalFilename || `Resume ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-8">
        <AttendanceSummaryCard employeeId={employeeId} />
        {isAdmin && <NotInformedWarningsCard employeeId={employeeId} />}
        {canViewSalary && (
          <SalarySlipsList employeeId={employeeId} employeeName={`${employee.firstName} ${employee.lastName ?? ''}`} />
        )}
        {canGenerateDocs && <GeneratedDocumentsList employeeId={employeeId} />}
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
        {!isOwnRecord && <ActivityTimeline employeeId={employeeId} />}
      </div>
    </div>
  )
}
