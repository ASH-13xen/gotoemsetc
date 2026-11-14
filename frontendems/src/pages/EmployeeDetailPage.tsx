import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, type Path } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, FileUp, KeyRound, Loader2, Save, Send, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'
import { StatusBadge } from '@/components/employees/StatusBadge'
import { GeneratedDocumentsList } from '@/components/documents/GeneratedDocumentsList'
import { MySignedDocumentsCard } from '@/components/documents/MySignedDocumentsCard'
import { MyDocumentsToSign, latestByDocument, useSignatures } from '@/components/documents/ESign'
import { UploadedDocumentsList } from '@/components/documents/UploadedDocumentsList'
import { UploadedDocumentImage } from '@/components/documents/UploadedDocumentImage'
import { RequestDocumentsModal } from '@/components/uploadRequests/RequestDocumentsModal'
import { CredentialsDialog } from '@/components/employees/CredentialsDialog'
import { FlagStrip, EmployeeFlagsManager } from '@/components/employees/EmployeeFlags'
import { GenerateSalarySlipDialog } from '@/components/salary/GenerateSalarySlipDialog'
import { SalarySlipsList } from '@/components/salary/SalarySlipsList'
import { RequestHistoryTable } from '@/components/uploadRequests/RequestHistoryTable'
import { ActivityTimeline } from '@/components/employees/ActivityTimeline'
import { AttendancePair } from '@/components/attendance/AttendancePair'
import { NotInformedWarningsCard } from '@/components/attendance/NotInformedWarningsCard'
import { PendingWarningsModal } from '@/components/attendance/PendingWarningsModal'
import { OffboardDialog, type OffboardDetails } from '@/components/employees/OffboardDialog'
import { EmployeeDevices } from '@/components/employees/EmployeeDevices'
import { CheckboxRow, MissingBadge, SecretInput, Section, useOpenSections } from '@/components/employees/ProfileParts'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { extractApiErrorMessage } from '@/lib/errors'
import { hasAnyPermission, hasPermission, isAdmin as canUploadDirectly, isAdminLike } from '@/lib/permissions'
import { DocsOfType, UploadDocumentDialog } from '@/components/employees/ProfileDocuments'
import { can } from '@/lib/access'
import { useCompleteProbation, useEmployee, usePromote, useUpdateEmployee } from '@/hooks/useEmployees'
import { LetterDialog } from '@/components/employees/LetterDialog'
import { useUploadedDocuments } from '@/hooks/useUploadRequests'
import { BLOOD_GROUPS, getOrgNodes, type Address, type Employee, type EmployeeStatus, type EmploymentType, type OrgNode } from '@/api/employees.api'

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
  emergencyContact: string
  instagramId: string
  permanentAddress: AddressForm
  localAddress: AddressForm
  dob: string
  maritalStatus: '' | 'single' | 'married'
  anniversaryDate: string
  bloodGroup: string
  designation: string
  // The Organisation chart box the designation comes from (not saved directly —
  // a change goes through the promotion, with its letter).
  designationNode: string
  department: string
  workLocation: string
  workingHoursStart: string
  workingHoursEnd: string
  dateOfJoining: string
  dateOfHiring: string
  employmentType: EmploymentType
  status: EmployeeStatus
  companyEmail: string
  companyEmailPassword: string
  ctcAnnual: string
  monthlyPay: string
  bankName: string
  bankAccountNumber: string
  bankIFSC: string
  payDate: string
  companyLoginAdded: boolean
  personalPhoneAdded: boolean
  canvaAccessGiven: boolean
  addedToReelsInstagram: boolean
  probationCompleted: boolean
  probationCompletedAt: string
  excludeFromPayroll: boolean
  worksFromHome: boolean
  endDate: string
  reasonForLeaving: string
  removedFromGroupsAndReels: boolean
  mailDeactivated: boolean
}

type SectionKey =
  | 'personal'
  | 'employment'
  | 'onboarding'
  | 'offboarding'
  | 'address'
  | 'bank'
  | 'devices'
  | 'generated'
  | 'requested'
  | 'salary'
  | 'extra'
  | 'attendance'
  | 'recruitment'
  | 'activity'

// Details that used to be typed into Extra details — shown in their own
// fields as a starting value, and saved there the next time the profile is
// saved. The Extra details entries themselves are left as they are.
const FROM_EXTRA: { field: 'emergencyContact' | 'companyEmail' | 'companyEmailPassword'; key: RegExp }[] = [
  { field: 'emergencyContact', key: /^\s*emergency/i },
  { field: 'companyEmail', key: /^\s*company\s*mail\s*id\s*$/i },
  { field: 'companyEmailPassword', key: /^\s*company\s*mail\s*password\s*$/i },
]

function toDateInputValue(value: string | undefined | null): string {
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

// What Extra details holds for a field the profile now has its own place for.
function extraFallbacks(employee: Employee): Partial<Record<'emergencyContact' | 'companyEmail' | 'companyEmailPassword', string>> {
  const out: Partial<Record<'emergencyContact' | 'companyEmail' | 'companyEmailPassword', string>> = {}
  for (const { field, key } of FROM_EXTRA) {
    if ((employee[field] ?? '').trim()) continue
    const hit = (employee.extraDetails ?? []).find((d) => key.test(d.key) && (d.value ?? '').trim())
    if (hit?.value) out[field] = hit.value
  }
  return out
}

function toFormValues(employee: Employee): FormValues {
  const fallback = extraFallbacks(employee)
  return {
    employeeCode: employee.employeeCode ?? '',
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    personalEmail: employee.personalEmail ?? '',
    phone: employee.phone ?? '',
    emergencyContact: employee.emergencyContact || fallback.emergencyContact || '',
    instagramId: employee.instagramId ?? '',
    permanentAddress: toAddressForm(employee.permanentAddress),
    localAddress: toAddressForm(employee.localAddress),
    dob: toDateInputValue(employee.dob),
    maritalStatus: employee.maritalStatus ?? '',
    anniversaryDate: toDateInputValue(employee.anniversaryDate ?? undefined),
    bloodGroup: employee.bloodGroup ?? '',
    designation: employee.designation ?? '',
    designationNode: '',
    department: employee.department ?? '',
    workLocation: employee.workLocation ?? '',
    workingHoursStart: employee.workingHoursStart ?? '09:30',
    workingHoursEnd: employee.workingHoursEnd ?? '18:30',
    dateOfJoining: toDateInputValue(employee.dateOfJoining),
    dateOfHiring: toDateInputValue(employee.dateOfHiring),
    employmentType: employee.employmentType ?? 'full-time',
    status: employee.status ?? 'draft',
    companyEmail: employee.companyEmail || fallback.companyEmail || '',
    companyEmailPassword: employee.companyEmailPassword || fallback.companyEmailPassword || '',
    ctcAnnual: employee.ctcAnnual != null ? String(employee.ctcAnnual) : '',
    monthlyPay: employee.monthlyPay != null ? String(employee.monthlyPay) : '',
    bankName: employee.bankName ?? '',
    bankAccountNumber: employee.bankAccountNumber ?? '',
    bankIFSC: employee.bankIFSC ?? '',
    payDate: employee.payDate != null ? String(employee.payDate) : '',
    companyLoginAdded: employee.companyLoginAdded ?? false,
    personalPhoneAdded: employee.personalPhoneAdded ?? false,
    canvaAccessGiven: employee.canvaAccessGiven ?? false,
    addedToReelsInstagram: employee.addedToReelsInstagram ?? false,
    probationCompleted: employee.probationCompleted ?? false,
    probationCompletedAt: toDateInputValue(employee.probationCompletedAt ?? undefined),
    excludeFromPayroll: employee.excludeFromPayroll ?? false,
    worksFromHome: employee.worksFromHome ?? false,
    endDate: toDateInputValue(employee.endDate),
    reasonForLeaving: employee.reasonForLeaving ?? '',
    removedFromGroupsAndReels: employee.removedFromGroupsAndReels ?? false,
    mailDeactivated: employee.mailDeactivated ?? false,
  }
}

// Every detail "Save changes" needs filled in (Save as draft doesn't).
// `admin`: only for those who see the salary, ID and bank fields.
type Required = { name: string; label: string; section: SectionKey; admin?: boolean; when?: (v: FormValues, same: boolean) => boolean }
const ADDRESS_PARTS: [keyof AddressForm, string][] = [
  ['line1', 'address line 1'],
  ['city', 'city'],
  ['state', 'state'],
  ['pincode', 'pincode'],
  ['country', 'country'],
]
const REQUIRED: Required[] = [
  { name: 'firstName', label: 'First name', section: 'personal' },
  { name: 'lastName', label: 'Last name', section: 'personal' },
  { name: 'personalEmail', label: 'Personal email', section: 'personal' },
  { name: 'phone', label: 'Phone', section: 'personal' },
  { name: 'emergencyContact', label: 'Emergency contact number', section: 'personal' },
  { name: 'instagramId', label: 'Instagram ID', section: 'personal' },
  { name: 'dob', label: 'Date of birth', section: 'personal' },
  { name: 'bloodGroup', label: 'Blood group', section: 'personal' },
  { name: 'maritalStatus', label: 'Marital status', section: 'personal' },
  { name: 'anniversaryDate', label: 'Anniversary date', section: 'personal', when: (v) => v.maritalStatus === 'married' },
  { name: 'designation', label: 'Designation', section: 'employment', when: (v) => !v.designationNode },
  { name: 'department', label: 'Department', section: 'employment' },
  { name: 'workLocation', label: 'Work location', section: 'employment' },
  { name: 'workingHoursStart', label: 'Shift start', section: 'employment' },
  { name: 'workingHoursEnd', label: 'Shift end', section: 'employment' },
  { name: 'dateOfHiring', label: 'Date of hiring', section: 'employment' },
  { name: 'dateOfJoining', label: 'Date of joining', section: 'employment' },
  { name: 'probationCompletedAt', label: 'Probation completed on', section: 'employment', when: (v) => v.probationCompleted },
  { name: 'companyEmail', label: 'Company mail ID', section: 'employment' },
  { name: 'companyEmailPassword', label: 'Company mail password', section: 'employment', admin: true },
  { name: 'monthlyPay', label: 'Monthly pay', section: 'employment', admin: true },
  { name: 'ctcAnnual', label: 'Annual CTC', section: 'employment', admin: true },
  { name: 'payDate', label: 'Pay date', section: 'employment', admin: true },
  { name: 'employeeCode', label: 'Biometric PIN', section: 'onboarding', admin: true },
  { name: 'endDate', label: 'Last working day', section: 'offboarding', when: (v) => v.status === 'offboarded' },
  { name: 'reasonForLeaving', label: 'Reason for leaving', section: 'offboarding', when: (v) => v.status === 'offboarded' },
  ...ADDRESS_PARTS.map(([part, label]) => ({ name: `permanentAddress.${part}`, label: `Permanent ${label}`, section: 'address' as SectionKey })),
  ...ADDRESS_PARTS.map(([part, label]) => ({ name: `localAddress.${part}`, label: `Local ${label}`, section: 'address' as SectionKey, when: (_v: FormValues, same: boolean) => !same })),
  { name: 'bankName', label: 'Bank name', section: 'bank', admin: true },
  { name: 'bankAccountNumber', label: 'Bank A/C number', section: 'bank', admin: true },
  { name: 'bankIFSC', label: 'IFSC code', section: 'bank', admin: true },
]

const valueAt = (v: FormValues, name: string): unknown => name.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), v)
const isEmpty = (x: unknown) => x == null || (typeof x === 'string' && !x.trim())

function missingOf(v: FormValues, same: boolean, admin: boolean): Required[] {
  return REQUIRED.filter((r) => (!r.admin || admin) && (!r.when || r.when(v, same)) && isEmpty(valueAt(v, r.name)))
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

// A chart box as a designation: its title, with its team (or the box above
// it) so the same title in two teams can be told apart.
function boxLabel(node: OrgNode, byId: Map<string, OrgNode>): string {
  let up = node.parent ? byId.get(node.parent) : undefined
  while (up && up.kind === 'team_role') up = up.parent ? byId.get(up.parent) : undefined
  const where = up?.kind === 'team' ? up.title : up && up.parent ? `under ${up.title}` : ''
  return where ? `${node.title} — ${where}` : node.title
}

// The CV / resume files kept from recruitment (people hired through the pipeline).
function ResumeLinks({ employee }: { employee: Employee }) {
  if (!employee.resumes?.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {employee.resumes.map((resume, i) => (
        <a
          key={i}
          href={resume.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60"
        >
          <FileText className="size-3.5" />
          {resume.originalFilename || `Resume ${i + 1}`} · from recruitment
        </a>
      ))}
    </div>
  )
}

// A day (YYYY-MM-DD) as it was in India — today by default.
const istDay = (at: string | number = Date.now()) => new Date(new Date(at).getTime() + 330 * 60 * 1000).toISOString().slice(0, 10)

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')

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

  // Keyed on the employee id so navigating between employees always mounts a
  // fresh form — useForm's defaultValues are right on its very first render.
  return <EmployeeDetailForm key={data.employee._id} employee={data.employee} employeeId={id as string} />
}

function EmployeeDetailForm({ employee, employeeId }: { employee: Employee; employeeId: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = isAdminLike(user)
  const canFlag = can(user, 'performance_flags')
  const canSeeWarnings = can(user, 'hrms')
  // A plain employee always lands back on their own page, so "Back to
  // dashboard" is only for someone with somewhere else to go.
  const canBackToPortal = hasAnyPermission(user)
  const canGenerateDocs = hasPermission(user, 'generate_documents')
  const canRequestDocs = hasPermission(user, 'request_documents')
  const canAddCredentials = hasPermission(user, 'add_credentials')
  const canViewSalary = hasPermission(user, 'view_salary_slip')
  const canEditDetails = hasPermission(user, 'edit_employee_details')
  const isOwnRecord = user?.employeeLink === employeeId
  const { data: uploadedDocsData } = useUploadedDocuments(employeeId, { enabled: canRequestDocs })
  const photoDoc = uploadedDocsData?.uploadedDocuments.find((d) => d.docType === 'photo')
  // The letter that completed probation (newest first) — offers its day when
  // the completion date wasn't recorded.
  const probationLetter = uploadedDocsData?.uploadedDocuments.find((d) => d.docType === 'probation_letter')
  const updateEmployee = useUpdateEmployee(employeeId)
  const completeProbation = useCompleteProbation(employeeId)
  const promote = usePromote(employeeId)
  const { data: orgNodes } = useQuery({ queryKey: ['org-nodes'], queryFn: getOrgNodes, staleTime: 60_000 })
  const sections = useOpenSections(['personal', 'employment', 'attendance'])
  // Documents sent to them to sign online (their own profile).
  const { data: mySignatures } = useSignatures(employeeId, isOwnRecord && !canGenerateDocs)
  const myLatest = isOwnRecord && !canGenerateDocs ? [...latestByDocument(mySignatures).values()] : []
  const toSign = myLatest.filter((x) => x.status === 'sent' || x.status === 'viewed').length
  const [probationOpen, setProbationOpen] = useState(false)
  // The day probation was completed, asked for with the letter.
  const [probationOn, setProbationOn] = useState(() => istDay())
  // Uploading a document straight onto this employee (the admin only).
  const [uploadOpen, setUploadOpen] = useState(false)
  const directUpload = canUploadDirectly(user)
  // A promotion — a new designation, or a change to a salary already set —
  // waits here for the letter and the month it counts from, then the rest saves.
  const [promotion, setPromotion] = useState<{ values: FormValues; draft: boolean; toNode?: string; monthlyPay?: number; ctcAnnual?: number } | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 7))
  const [offboardOpen, setOffboardOpen] = useState(false)
  // After a "Save changes" with details still empty: those fields show red.
  const [showMissing, setShowMissing] = useState(false)

  const initial = useMemo(() => toFormValues(employee), [employee])
  const fallbacks = useMemo(() => extraFallbacks(employee), [employee])
  const { register, handleSubmit, control, watch, setValue, getValues, reset, resetField, formState } = useForm<FormValues>({ defaultValues: initial })
  const { isDirty, dirtyFields } = formState
  const [sameInitial, setSameInitial] = useState(() => addressesEqual(initial.permanentAddress, initial.localAddress))
  const [sameAsPermanent, setSameAsPermanent] = useState(sameInitial)
  const dirty = isDirty || sameAsPermanent !== sameInitial

  const nodeById = useMemo(() => new Map((orgNodes ?? []).map((n) => [n._id, n])), [orgNodes])
  const boxes = useMemo(
    () =>
      (orgNodes ?? [])
        .filter((n) => n.parent && n.kind !== 'team')
        .map((n) => ({ _id: n._id, label: boxLabel(n, nodeById) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [orgNodes, nodeById]
  )
  const heldNode = useMemo(() => {
    const held = (orgNodes ?? []).filter((n) => n.parent && n.kind !== 'team' && n.assignees.some((a) => a._id === employeeId))
    return held.find((n) => n.title.trim().toUpperCase() === (employee.designation ?? '').trim().toUpperCase()) ?? held[0] ?? null
  }, [orgNodes, employeeId, employee.designation])
  useEffect(() => {
    if (heldNode) resetField('designationNode', { defaultValue: heldNode._id })
  }, [heldNode, resetField])

  const values = watch()
  const permanentAddress = values.permanentAddress
  // "Same as permanent": the local address follows the permanent one as it's typed.
  const permanentKey = JSON.stringify(permanentAddress ?? {})
  useEffect(() => {
    if (sameAsPermanent) setValue('localAddress', JSON.parse(permanentKey))
  }, [sameAsPermanent, permanentKey, setValue])
  const status = values.status
  const missing = missingOf(values, sameAsPermanent, isAdmin)
  const missingIn = (s: SectionKey) => (canEditDetails ? missing.filter((m) => m.section === s).length : 0)
  const bad = (name: string) => (showMissing && missing.some((m) => m.name === name) ? 'ring-2 ring-amber-500/70' : '')
  const fullName = `${employee.firstName} ${employee.lastName ?? ''}`.trim()

  // ---- saving: only what changed (plus details found in Extra details), never blanks over stored values

  const buildPayload = (v: FormValues, exclude: string[] = []) => {
    const keys = new Set<string>(Object.keys(dirtyFields).filter((k) => (dirtyFields as Record<string, unknown>)[k]))
    keys.delete('designationNode')
    exclude.forEach((k) => keys.delete(k))
    Object.keys(fallbacks).forEach((k) => keys.add(k))
    if (sameAsPermanent !== sameInitial || (sameAsPermanent && keys.has('permanentAddress'))) keys.add('localAddress')
    if (keys.has('maritalStatus')) keys.add('anniversaryDate')
    const out: Record<string, unknown> = {}
    for (const k of keys) {
      const raw = v[k as keyof FormValues]
      switch (k) {
        case 'employeeCode':
          if (v.employeeCode.trim()) out.employeeCode = v.employeeCode.trim()
          break
        case 'ctcAnnual':
        case 'monthlyPay':
        case 'payDate':
          if (String(raw).trim() !== '') out[k] = Number(raw)
          break
        case 'dob':
        case 'dateOfJoining':
        case 'dateOfHiring':
        case 'endDate':
        case 'probationCompletedAt':
          if (raw) out[k] = raw
          break
        case 'maritalStatus':
          out.maritalStatus = v.maritalStatus || null
          break
        case 'anniversaryDate':
          out.anniversaryDate = v.maritalStatus === 'married' && v.anniversaryDate ? v.anniversaryDate : null
          break
        case 'localAddress':
          out.localAddress = sameAsPermanent ? v.permanentAddress : v.localAddress
          break
        default:
          out[k] = raw
      }
    }
    return out
  }

  const afterSave = () => {
    reset(getValues())
    setSameInitial(sameAsPermanent)
    setShowMissing(false)
  }

  const saveDetails = (v: FormValues, draft = false, exclude: string[] = []) => {
    const payload = buildPayload(v, exclude)
    if (!Object.keys(payload).length) {
      afterSave()
      return
    }
    updateEmployee.mutate(payload, {
      onSuccess: () => {
        afterSave()
        toast.success(draft ? 'Saved as draft — some details are still to fill in' : 'Saved')
      },
      onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not save changes')),
    })
  }

  // The first salary saves directly. A new designation, or a change to a
  // salary already set, is a promotion: the letter first, then the rest saves.
  const save = (v: FormValues, draft: boolean) => {
    const hadSalary = Boolean(employee.monthlyPay || employee.ctcAnnual)
    const nextMonthly = v.monthlyPay ? Number(v.monthlyPay) : undefined
    const nextCtc = v.ctcAnnual ? Number(v.ctcAnnual) : undefined
    const monthlyChanged = nextMonthly !== undefined && nextMonthly !== (employee.monthlyPay ?? undefined)
    const ctcChanged = nextCtc !== undefined && nextCtc !== (employee.ctcAnnual ?? undefined)
    const toNode = v.designationNode && v.designationNode !== (heldNode?._id ?? '') ? v.designationNode : undefined
    if (toNode || (hadSalary && (monthlyChanged || ctcChanged))) {
      setPromotion({
        values: v,
        draft,
        toNode,
        monthlyPay: hadSalary && monthlyChanged ? nextMonthly : undefined,
        ctcAnnual: hadSalary && ctcChanged ? nextCtc : undefined,
      })
      return
    }
    saveDetails(v, draft)
  }

  const onSaveChanges = handleSubmit((v) => {
    const gaps = missingOf(v, sameAsPermanent, isAdmin)
    if (gaps.length) {
      setShowMissing(true)
      sections.openAll([...new Set(gaps.map((g) => g.section))])
      toast.error(`Fill in ${gaps.length} more detail${gaps.length === 1 ? '' : 's'} first — ${gaps.slice(0, 4).map((g) => g.label).join(', ')}${gaps.length > 4 ? '…' : ''}. Or save it as a draft.`)
      return
    }
    save(v, false)
  })
  const onSaveDraft = handleSubmit((v) => save(v, true))

  const onConfirmPromotion = (letter: File) => {
    if (!promotion) return
    const { values: v, draft, toNode, monthlyPay, ctcAnnual } = promotion
    promote.mutate(
      { monthlyPay, ctcAnnual, effectiveFrom, toNode, fromNode: toNode ? heldNode?._id : undefined, letter },
      {
        onSuccess: () => {
          toast.success('Promotion saved — the letter is in their documents')
          setPromotion(null)
          resetField('monthlyPay', { defaultValue: v.monthlyPay })
          resetField('ctcAnnual', { defaultValue: v.ctcAnnual })
          resetField('designationNode', { defaultValue: v.designationNode })
          // The rest of the changes (a first salary entered with it saves here too).
          saveDetails(v, draft, monthlyPay !== undefined || ctcAnnual !== undefined ? ['monthlyPay', 'ctcAnnual', 'designation'] : ['designation'])
        },
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not save the promotion')),
      }
    )
  }

  const onConfirmProbation = (letter: File) => {
    completeProbation.mutate(
      { letter, completedOn: probationOn },
      {
        onSuccess: () => {
          resetField('probationCompleted', { defaultValue: true })
          resetField('probationCompletedAt', { defaultValue: probationOn })
          setProbationOpen(false)
          toast.success('Probation completed — the letter is saved in documents')
        },
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not complete probation')),
      }
    )
  }

  // Confirming the off-boarding modal saves straight away — status plus the
  // off-boarding details together — so nobody is left half off-boarded.
  const onConfirmOffboard = (details: OffboardDetails) => {
    updateEmployee.mutate(
      { status: 'offboarded', ...details },
      {
        onSuccess: () => {
          resetField('status', { defaultValue: 'offboarded' })
          resetField('endDate', { defaultValue: details.endDate })
          resetField('reasonForLeaving', { defaultValue: details.reasonForLeaving })
          resetField('removedFromGroupsAndReels', { defaultValue: details.removedFromGroupsAndReels })
          resetField('mailDeactivated', { defaultValue: details.mailDeactivated })
          setOffboardOpen(false)
          toast.success('Employee off-boarded — their EMS login has been deactivated')
        },
        onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not off-board this employee')),
      }
    )
  }

  const onToggleSameAsPermanent = (checked: boolean) => {
    setSameAsPermanent(checked)
    if (checked) setValue('localAddress', permanentAddress)
  }

  // Monthly pay × 12 = annual CTC — changing either fills in the other.
  const linkPay = (from: 'monthlyPay' | 'ctcAnnual', raw: string) => {
    if (raw.trim() === '') return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    if (from === 'monthlyPay') setValue('ctcAnnual', String(Math.round(n * 12 * 100) / 100), { shouldDirty: true })
    else setValue('monthlyPay', String(Math.round((n / 12) * 100) / 100), { shouldDirty: true })
  }

  // The local address: the same boxes as the permanent one. "Same as
  // permanent" shows the permanent address in them, read-only.
  const localProps = (part: keyof AddressForm) => ({
    ...register(`localAddress.${part}`),
    placeholder: { line1: 'Address line 1', line2: 'Address line 2', city: 'City', state: 'State', pincode: 'Pincode', country: 'Country' }[part],
    readOnly: sameAsPermanent,
    className: cn(
      part !== 'pincode' && 'uppercase',
      sameAsPermanent && 'cursor-default focus-visible:border-transparent focus-visible:bg-secondary/60 focus-visible:ring-0',
      part !== 'line2' && bad(`localAddress.${part}`)
    ),
  })

  const text = (name: Path<FormValues>, label: string, opts: { upper?: boolean; type?: string; placeholder?: string } = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={name} type={opts.type} placeholder={opts.placeholder} className={cn(opts.upper && 'uppercase', bad(name))} {...register(name)} />
    </div>
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 py-6">
      {isOwnRecord && <PendingWarningsModal employeeId={employeeId} />}

      <LetterDialog
        open={probationOpen}
        onOpenChange={setProbationOpen}
        title="Complete probation"
        description={`Attach the letter confirming ${employee.firstName}'s probation is over. Probation is only marked completed with it.`}
        confirmLabel="Attach & complete probation"
        isPending={completeProbation.isPending}
        canConfirm={/^\d{4}-\d{2}-\d{2}$/.test(probationOn) && probationOn <= istDay()}
        onConfirm={onConfirmProbation}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="probationCompletedOn">Completed on</Label>
          <Input id="probationCompletedOn" type="date" max={istDay()} value={probationOn} onChange={(e) => setProbationOn(e.target.value)} />
          <p className="text-xs text-muted-foreground">Shown in Employment details as the probation completion date.</p>
        </div>
      </LetterDialog>
      <LetterDialog
        open={Boolean(promotion)}
        onOpenChange={(open) => !open && setPromotion(null)}
        title="Promotion"
        description={`${employee.firstName}'s ${[
          promotion?.toNode ? `designation becomes ${boxes.find((b) => b._id === promotion.toNode)?.label ?? 'the new one'} (they move into that box in the Organisation chart)` : '',
          promotion?.monthlyPay !== undefined ? `pay becomes ₹${promotion.monthlyPay.toLocaleString('en-IN')} a month` : promotion?.ctcAnnual !== undefined ? `annual CTC becomes ₹${promotion.ctcAnnual.toLocaleString('en-IN')}` : '',
        ]
          .filter(Boolean)
          .join(', and ')}. It only changes with the promotion letter attached; today becomes their date of last promotion.`}
        confirmLabel="Attach & save the promotion"
        isPending={promote.isPending}
        canConfirm={/^\d{4}-\d{2}$/.test(effectiveFrom)}
        onConfirm={onConfirmPromotion}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="promotionEffectiveFrom">Counts from (month)</Label>
          <Input id="promotionEffectiveFrom" type="month" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          <p className="text-xs text-muted-foreground">Salary slips for this month and later use the new pay; earlier months keep the old one, even if generated again.</p>
        </div>
      </LetterDialog>
      <OffboardDialog
        open={offboardOpen}
        onOpenChange={setOffboardOpen}
        employeeName={fullName}
        initial={{
          endDate: toDateInputValue(employee.endDate),
          reasonForLeaving: employee.reasonForLeaving ?? '',
          removedFromGroupsAndReels: employee.removedFromGroupsAndReels ?? false,
          mailDeactivated: employee.mailDeactivated ?? false,
        }}
        isPending={updateEmployee.isPending}
        onConfirm={onConfirmOffboard}
      />

      {/* The name card — one line, pinned — and, under it while something
          has changed, the save bar. */}
      <div className="sticky top-0 z-30 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:flex-nowrap [&>*]:shrink-0">
          {photoDoc && <UploadedDocumentImage documentId={photoDoc._id} alt={fullName} className="h-11 w-9 rounded-md border border-primary/20 object-cover" />}
          <h1 className="min-w-0 !shrink truncate text-xl font-semibold uppercase tracking-tight text-foreground sm:text-2xl">{fullName}</h1>
          {employee.employeeCode && <span className="font-mono text-xs text-muted-foreground">{employee.employeeCode}</span>}
          <StatusBadge status={employee.status} />
          <FlagStrip flags={employee.flags ?? []} />
          {canFlag && <EmployeeFlagsManager employeeId={employeeId} flags={employee.flags ?? []} />}
          {canEditDetails && missing.length > 0 && !dirty && (
            <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700" title="Details still to fill in">
              {missing.length} missing
            </span>
          )}
          {canBackToPortal && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/')}>
              Back to dashboard
            </Button>
          )}
        </div>
        {canEditDetails && dirty && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
            <span className="min-w-0 flex-1 text-sm text-foreground">
              <b>Unsaved changes</b>
              <span className="text-muted-foreground">{missing.length ? ` · ${missing.length} required detail${missing.length === 1 ? '' : 's'} still empty` : ' · everything is filled in'}</span>
            </span>
            <Button type="button" size="sm" variant="outline" disabled={updateEmployee.isPending || promote.isPending} onClick={onSaveDraft}>
              Save as draft
            </Button>
            <Button type="button" size="sm" disabled={updateEmployee.isPending || promote.isPending} onClick={onSaveChanges}>
              {updateEmployee.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save changes
            </Button>
          </div>
        )}
      </div>

      <QuickActions>
        {canGenerateDocs && (
          <QuickActionItem icon={<FileText className="size-4" />} label="Generate docs" description="Document system" onClick={() => navigate(`/employees/${employeeId}/wizard`)} />
        )}
        {canRequestDocs && (
          <RequestDocumentsModal
            employeeId={employeeId}
            employeeName={fullName}
            employeePhone={employee.phone}
            trigger={<QuickActionItem icon={<Send className="size-4" />} label="Request files" description="HR collection" />}
          />
        )}
        {canAddCredentials && (
          <CredentialsDialog employeeId={employeeId} employeeName={fullName} trigger={<QuickActionItem icon={<KeyRound className="size-4" />} label="Add credentials" description="Platform access" />} />
        )}
        {canViewSalary && (
          <GenerateSalarySlipDialog employeeId={employeeId} employeeName={fullName} trigger={<QuickActionItem icon={<Wallet className="size-4" />} label="Generate salary slip" description="Payroll" />} />
        )}
        {directUpload && <QuickActionItem icon={<FileUp className="size-4" />} label="Upload documents" description="Attach directly" onClick={() => setUploadOpen(true)} />}
      </QuickActions>
      {uploadOpen && <UploadDocumentDialog employeeId={employeeId} employeeName={fullName} open onOpenChange={setUploadOpen} />}

      {/* ---- Personal details */}
      <Section title="Personal details" open={sections.isOpen('personal')} onToggle={() => sections.toggle('personal')} badge={<MissingBadge count={missingIn('personal')} />}>
        <fieldset disabled={!canEditDetails} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {text('firstName', 'First name', { upper: true })}
          {text('lastName', 'Last name', { upper: true })}
          <div className="grid gap-1.5">
            <Label htmlFor="personalEmail" className="text-xs text-muted-foreground">
              Personal email
            </Label>
            <Input id="personalEmail" type="email" className={cn('normal-case', bad('personalEmail'))} {...register('personalEmail')} />
          </div>
          {text('phone', 'Phone')}
          {text('emergencyContact', 'Emergency contact number')}
          {text('instagramId', 'Instagram ID', { upper: true })}
          {text('dob', 'Date of birth', { type: 'date' })}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Blood group</Label>
            <Controller
              control={control}
              name="bloodGroup"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={bad('bloodGroup')}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Marital status</Label>
            <Controller
              control={control}
              name="maritalStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={bad('maritalStatus')}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {values.maritalStatus === 'married' && text('anniversaryDate', 'Anniversary date', { type: 'date' })}
        </fieldset>
        {(canRequestDocs || (employee.resumes?.length ?? 0) > 0) && (
          <div className="mt-4">
            {canRequestDocs ? (
              <DocsOfType
                employeeId={employeeId}
                employeeName={fullName}
                title="CV / Resume"
                docTypes={['resume']}
                match={/\b(cv|resume|résumé|curriculum)\b/i}
                canUpload={directUpload}
                extra={<ResumeLinks employee={employee} />}
              />
            ) : (
              <div className="grid gap-2 rounded-xl border border-border bg-secondary/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CV / Resume</p>
                <ResumeLinks employee={employee} />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ---- Employment details */}
      <Section title="Employment details" open={sections.isOpen('employment')} onToggle={() => sections.toggle('employment')} badge={<MissingBadge count={missingIn('employment')} />}>
        <fieldset disabled={!canEditDetails} className="grid gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Designation (Organisation chart)</Label>
              <Controller
                control={control}
                name="designationNode"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange} disabled={!isAdmin || !boxes.length}>
                    <SelectTrigger className={bad('designation')}>
                      <SelectValue placeholder={employee.designation ? `${employee.designation} (not in the chart)` : 'Choose their box'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {boxes.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[11px] text-muted-foreground">
                {heldNode
                  ? heldNode.title.trim().toUpperCase() !== (employee.designation ?? '').trim().toUpperCase()
                    ? `Saved as “${employee.designation}”. A change goes through a promotion.`
                    : 'A change goes through a promotion (with the letter).'
                  : 'Not placed in the Organisation chart yet — choosing a box places them in it (with the promotion letter).'}
              </p>
            </div>
            {text('department', 'Department', { upper: true })}
            {text('workLocation', 'Work location', { upper: true })}
            <div className="grid grid-cols-2 gap-4">
              {text('workingHoursStart', 'Shift start', { type: 'time' })}
              {text('workingHoursEnd', 'Shift end', { type: 'time' })}
            </div>
            {text('dateOfHiring', 'Date of hiring', { type: 'date' })}
            {text('dateOfJoining', 'Date of joining', { type: 'date' })}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Date of last promotion</Label>
              <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-secondary/30 px-3 text-sm text-foreground" title="Set when a promotion letter is attached — nobody can edit it">
                {employee.lastPromotionAt ? fmtDay(employee.lastPromotionAt) : 'No promotion yet'}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="probationCompletedAt" className="text-xs text-muted-foreground">
                Probation completed on
              </Label>
              {values.probationCompleted && canEditDetails ? (
                <>
                  <Input id="probationCompletedAt" type="date" max={istDay()} className={bad('probationCompletedAt')} {...register('probationCompletedAt')} />
                  {!values.probationCompletedAt && probationLetter && (
                    <button
                      type="button"
                      className="justify-self-start text-xs font-medium text-primary hover:underline"
                      onClick={() => setValue('probationCompletedAt', istDay(probationLetter.createdAt), { shouldDirty: true })}
                    >
                      The letter was attached on {fmtDay(istDay(probationLetter.createdAt))} — use that day
                    </button>
                  )}
                </>
              ) : (
                <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-secondary/30 px-3 text-sm text-foreground">
                  {!values.probationCompleted ? 'Not completed yet' : values.probationCompletedAt ? fmtDay(values.probationCompletedAt) : 'Day not recorded'}
                </div>
              )}
            </div>
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
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      // Off-boarding goes through its confirmation (last working day etc.).
                      if (value === 'offboarded' && employee.status !== 'offboarded') {
                        setOffboardOpen(true)
                        return
                      }
                      field.onChange(value)
                    }}
                  >
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
            <div className="grid gap-1.5">
              <Label htmlFor="companyEmail" className="text-xs text-muted-foreground">
                Company mail ID
              </Label>
              <Input id="companyEmail" type="email" className={cn('normal-case', bad('companyEmail'))} {...register('companyEmail')} />
            </div>
            {isAdmin && (
              <div className="grid gap-1.5">
                <Label htmlFor="companyEmailPassword" className="text-xs text-muted-foreground">
                  Company mail password
                </Label>
                <SecretInput id="companyEmailPassword" className={bad('companyEmailPassword')} {...register('companyEmailPassword')} />
              </div>
            )}
          </div>

          <Controller
            control={control}
            name="worksFromHome"
            render={({ field }) => (
              <CheckboxRow
                label="Work from home"
                checked={field.value}
                onChange={field.onChange}
                info={
                  <>
                    A working day with no scans is marked Work From Home. Any scan, and the day is marked from the scans as usual. It counts from the day it is ticked — earlier
                    days keep what they have.
                    {employee.worksFromHome && employee.worksFromHomeSince ? ` Working from home since ${fmtDay(employee.worksFromHomeSince)}.` : ''}
                  </>
                }
              />
            )}
          />

          <Controller
            control={control}
            name="probationCompleted"
            render={({ field }) => (
              <CheckboxRow
                label="Probation completed"
                checked={field.value}
                // Ticking it asks for the letter (and the day); unticking is a plain correction.
                onChange={(checked) => {
                  if (!checked) return field.onChange(false)
                  setProbationOn(istDay())
                  setProbationOpen(true)
                }}
                info="Needs the letter confirming probation is over (it's saved in their documents). Completing probation unlocks the one paid leave a month."
              />
            )}
          />

          {isAdmin && (
            <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="monthlyPay" className="text-xs text-muted-foreground">
                    Monthly pay
                  </Label>
                  <Input id="monthlyPay" type="number" step="0.01" className={bad('monthlyPay')} {...register('monthlyPay', { onChange: (e) => linkPay('monthlyPay', e.target.value) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ctcAnnual" className="text-xs text-muted-foreground">
                    Annual CTC (monthly × 12)
                  </Label>
                  <Input id="ctcAnnual" type="number" step="0.01" className={bad('ctcAnnual')} {...register('ctcAnnual', { onChange: (e) => linkPay('ctcAnnual', e.target.value) })} />
                </div>
                {text('payDate', 'Pay date (day of month)', { type: 'number' })}
              </div>
              {(employee.salaryHistory?.length ?? 0) > 0 && (
                <div className="rounded-lg bg-card p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">Salary changes</p>
                  {[...(employee.salaryHistory ?? [])]
                    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                    .map((c) => (
                      <p key={c.effectiveFrom + String(c.changedAt)}>
                        From {new Date(c.effectiveFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}: ₹{(c.previousMonthlyPay ?? 0).toLocaleString('en-IN')} → ₹
                        {(c.monthlyPay ?? 0).toLocaleString('en-IN')} a month
                      </p>
                    ))}
                </div>
              )}
              {(employee.promotions?.length ?? 0) > 0 && (
                <div className="rounded-lg bg-card p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">Promotions</p>
                  {[...(employee.promotions ?? [])]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((p) => (
                      <p key={p.at}>
                        {fmtDay(p.at)}:{' '}
                        {p.designationFrom !== p.designationTo ? `${p.designationFrom || '—'} → ${p.designationTo}` : p.designationTo}
                        {p.salaryChanged ? ' · new salary' : ''}
                      </p>
                    ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Changing the salary or designation asks for the promotion letter and the month it counts from.</p>
              <Controller
                control={control}
                name="excludeFromPayroll"
                render={({ field }) => (
                  <CheckboxRow label="Exclude from payroll" checked={field.value} onChange={field.onChange} info="No salary slips, and not on the master salary sheet." />
                )}
              />
            </div>
          )}
        </fieldset>
      </Section>

      {/* ---- Onboarding details */}
      <Section title="Onboarding details" open={sections.isOpen('onboarding')} onToggle={() => sections.toggle('onboarding')} badge={<MissingBadge count={missingIn('onboarding')} />}>
        <fieldset disabled={!canEditDetails} className="grid gap-4">
          <div className="grid gap-1.5 md:max-w-xs">
            <Label htmlFor="employeeCode" className="text-xs text-muted-foreground">
              Biometric PIN (device code)
            </Label>
            <Input id="employeeCode" className={cn('uppercase', bad('employeeCode'))} disabled={!isAdmin} {...register('employeeCode')} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(
              [
                ['companyLoginAdded', 'Gotofriend12345 log in?'],
                ['personalPhoneAdded', 'GO-TO personal number added'],
                ['canvaAccessGiven', 'Canva access given?'],
                ['addedToReelsInstagram', 'Added to GO-TO reels on Instagram'],
              ] as const
            ).map(([name, label]) => (
              <Controller key={name} control={control} name={name} render={({ field }) => <CheckboxRow label={label} checked={field.value} onChange={field.onChange} />} />
            ))}
          </div>
        </fieldset>
      </Section>

      {/* ---- Offboarding — once they're off-boarded */}
      {status === 'offboarded' && (
        <Section title="Offboarding" open={sections.isOpen('offboarding')} onToggle={() => sections.toggle('offboarding')} badge={<MissingBadge count={missingIn('offboarding')} />}>
          <fieldset disabled={!canEditDetails} className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {text('endDate', 'Last working day', { type: 'date' })}
              {text('reasonForLeaving', 'Reason for leaving', { upper: true })}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Controller
                control={control}
                name="removedFromGroupsAndReels"
                render={({ field }) => <CheckboxRow label="Removed from groups + Go-To Reels" checked={field.value} onChange={field.onChange} />}
              />
              <Controller control={control} name="mailDeactivated" render={({ field }) => <CheckboxRow label="Mail deactivated" checked={field.value} onChange={field.onChange} />} />
            </div>
          </fieldset>
        </Section>
      )}

      {/* ---- Address */}
      <Section title="Address" open={sections.isOpen('address')} onToggle={() => sections.toggle('address')} badge={<MissingBadge count={missingIn('address')} />}>
        <fieldset disabled={!canEditDetails} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <div className="flex min-h-6 items-center">
              <p className="text-sm font-semibold text-foreground">Permanent address</p>
            </div>
            <Textarea {...register('permanentAddress.line1')} placeholder="Address line 1" className={cn('uppercase', bad('permanentAddress.line1'))} />
            <Input {...register('permanentAddress.line2')} placeholder="Address line 2" className="uppercase" />
            <div className="grid grid-cols-2 gap-3">
              <Input {...register('permanentAddress.city')} placeholder="City" className={cn('uppercase', bad('permanentAddress.city'))} />
              <Input {...register('permanentAddress.state')} placeholder="State" className={cn('uppercase', bad('permanentAddress.state'))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input {...register('permanentAddress.pincode')} placeholder="Pincode" className={bad('permanentAddress.pincode')} />
              <Input {...register('permanentAddress.country')} placeholder="Country" className={cn('uppercase', bad('permanentAddress.country'))} />
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Local address</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                <input type="checkbox" checked={sameAsPermanent} onChange={(e) => onToggleSameAsPermanent(e.target.checked)} className="size-4 accent-primary" />
                Same as permanent
              </label>
            </div>
            <Textarea {...localProps('line1')} />
            <Input {...localProps('line2')} />
            <div className="grid grid-cols-2 gap-3">
              <Input {...localProps('city')} />
              <Input {...localProps('state')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input {...localProps('pincode')} />
              <Input {...localProps('country')} />
            </div>
          </div>
        </fieldset>
      </Section>

      {/* ---- Bank details */}
      {isAdmin && (
        <Section title="Bank details" open={sections.isOpen('bank')} onToggle={() => sections.toggle('bank')} badge={<MissingBadge count={missingIn('bank')} />}>
          <fieldset disabled={!canEditDetails} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {text('bankName', 'Bank name', { upper: true })}
            {text('bankAccountNumber', 'Bank A/C number')}
            {text('bankIFSC', 'IFSC code', { upper: true })}
          </fieldset>
          {canRequestDocs && (
            <div className="mt-4">
              <DocsOfType employeeId={employeeId} employeeName={fullName} title="Passbook / Cancelled cheque" docTypes={['passbook_cancelled_cheque']} match={/\b(passbook|cheque|check)\b/i} canUpload={directUpload} />
            </div>
          )}
        </Section>
      )}

      {/* ---- My devices */}
      <Section title={isOwnRecord ? 'My devices' : 'Devices'} open={sections.isOpen('devices')} onToggle={() => sections.toggle('devices')}>
        <EmployeeDevices employeeId={employeeId} isOwnRecord={isOwnRecord} />
      </Section>

      {/* ---- Generated documents */}
      {(canGenerateDocs || isOwnRecord) && (
        <Section
          title="Generated documents"
          open={sections.isOpen('generated') || toSign > 0}
          onToggle={() => sections.toggle('generated')}
          flat
          badge={toSign > 0 ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">{toSign} to sign</span> : undefined}
        >
          {canGenerateDocs ? (
            <GeneratedDocumentsList employeeId={employeeId} />
          ) : (
            <div className="grid gap-4">
              <MyDocumentsToSign employeeId={employeeId} />
              <MySignedDocumentsCard
                employeeId={employeeId}
                exclude={myLatest.filter((x) => x.status === 'signed' || x.status === 'issued').map((x) => x.document)}
                hideWhenEmpty={myLatest.length > 0}
              />
            </div>
          )}
        </Section>
      )}

      {/* ---- Requested documents */}
      {canRequestDocs && (
        <Section title="Requested documents" open={sections.isOpen('requested')} onToggle={() => sections.toggle('requested')}>
          <div className="grid gap-4">
            <UploadedDocumentsList employeeId={employeeId} />
            <RequestHistoryTable employeeId={employeeId} employeeName={fullName} employeePhone={employee.phone} />
          </div>
        </Section>
      )}

      {/* ---- Salary slips */}
      {(canViewSalary || isOwnRecord) && (
        <Section title="Salary slips" open={sections.isOpen('salary')} onToggle={() => sections.toggle('salary')} flat>
          <SalarySlipsList employeeId={employeeId} employeeName={fullName} />
        </Section>
      )}

      {/* ---- Extra details — kept for later; nothing is shown in it for now
          (what was stored there stays in the record, untouched). */}
      <Section title="Extra details" open={sections.isOpen('extra')} onToggle={() => sections.toggle('extra')}>
        <p className="text-sm text-muted-foreground">Nothing here for now.</p>
      </Section>

      {/* ---- Attendance */}
      <Section title="Attendance" open={sections.isOpen('attendance')} onToggle={() => sections.toggle('attendance')}>
        <div className="grid gap-4">
          <AttendancePair employeeId={employeeId} side />
          {canSeeWarnings && <NotInformedWarningsCard employeeId={employeeId} />}
        </div>
      </Section>

      {/* ---- Recruitment details — only for people hired through the pipeline */}
      {employee.sourceApplicant && (
        <Section title="Recruitment details" open={sections.isOpen('recruitment')} onToggle={() => sections.toggle('recruitment')}>
          <div className="grid gap-6">
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
            <Field label="Why they wanted to join" value={employee.whyJoinCompany} />
            <Field label="Why they were hired" value={employee.whyHireYou} />
            <Field label="Why they were selected" value={employee.selectionNotes} />
            {employee.resumes && employee.resumes.length > 0 && (
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
            )}
          </div>
        </Section>
      )}

      {/* ---- Activity — admin only */}
      {isAdmin && (
        <Section title="Activity" open={sections.isOpen('activity')} onToggle={() => sections.toggle('activity')} flat>
          <ActivityTimeline employeeId={employeeId} />
        </Section>
      )}
    </div>
  )
}
