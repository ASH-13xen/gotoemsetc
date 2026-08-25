import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Copy, Search, UserPlus, Users2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { ApplicantStatusBadge } from '@/components/applicants/ApplicantStatusBadge'
import { AddApplicantDialog } from '@/components/applicants/AddApplicantDialog'
import { useApplicants } from '@/hooks/useApplicants'
import { useStaggerReveal } from '@/hooks/useStaggerReveal'
import { cn } from '@/lib/utils'
import type { ApplicantStatus } from '@/api/applicants.api'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfA1lvJ2yMgyCOgZYeJoPCidE6GcpzaIzCI3aoNxMOm2eie1w/viewform?usp=dialog'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

type Tab = 'pipeline' | 'rejected'

export default function ApplicantsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('pipeline')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ApplicantStatus | 'all'>('all')
  const debouncedSearch = useDebouncedValue(search, 350)

  const { data, isLoading } = useApplicants({
    search: debouncedSearch || undefined,
    status: tab === 'rejected' ? 'rejected' : status === 'all' ? undefined : status,
    limit: 50,
  })

  const applicants = (data?.items ?? []).filter((a) => (tab === 'rejected' ? true : a.status !== 'rejected'))
  const tableBodyRef = useStaggerReveal<HTMLTableSectionElement>([isLoading, applicants.length, tab])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Recruitment pipeline"
        title="Applicants"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/')}>
              Back to dashboard
            </Button>
            <AddApplicantDialog
              trigger={
                <Button>
                  <UserPlus className="size-4" />
                  Add applicant
                </Button>
              }
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="size-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Responder's form link</p>
            <a
              href={GOOGLE_FORM_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open Google Form
            </a>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(GOOGLE_FORM_URL)
            toast.success('Google Form link copied!')
          }}
        >
          <Copy className="size-3.5" />
          Copy link
        </Button>
      </div>

      <div className="flex items-center gap-6 border-b border-border">
        {(['pipeline', 'rejected'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-1 pb-3 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground/60" />
          <Input
            placeholder="Search by name, position..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === 'pipeline' && (
          <Select value={status} onValueChange={(v) => setStatus(v as ApplicantStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="interview_scheduled">Interview scheduled</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : applicants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Users2 className="size-10 text-muted-foreground/40" />
            <p className="text-base font-semibold text-foreground">
              {tab === 'rejected' ? 'No rejected applicants' : 'No applicants yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {tab === 'rejected'
                ? 'Applicants you reject will show up here.'
                : 'Add your first applicant to get started.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date applied</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {applicants.map((applicant) => (
                <TableRow
                  key={applicant._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/applicants/${applicant._id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {applicant.firstName} {applicant.lastName}
                  </TableCell>
                  <TableCell>{applicant.positionAppliedFor || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(applicant.dateApplied).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <ApplicantStatusBadge status={applicant.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
