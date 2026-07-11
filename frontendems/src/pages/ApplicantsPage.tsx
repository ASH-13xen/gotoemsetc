import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
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
import { ApplicantStatusBadge } from '@/components/applicants/ApplicantStatusBadge'
import { AddApplicantDialog } from '@/components/applicants/AddApplicantDialog'
import { useApplicants } from '@/hooks/useApplicants'
import { cn } from '@/lib/utils'
import type { ApplicantStatus } from '@/api/applicants.api'

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

  return (
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Logo/Branding Tile */}
          <Card className="md:col-span-2 p-8 flex flex-col justify-between min-h-[180px]">
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">RECRUITMENT PIPELINE</span>
            <h1 className="text-5xl md:text-7xl font-extrabold uppercase tracking-tighter text-foreground select-none">
              APPLICANTS
            </h1>
          </Card>

          {/* Action Tiles */}
          <div className="flex flex-col gap-4">
            {/* Back to Portal */}
            <div
              onClick={() => navigate('/')}
              className="bg-primary/10 text-primary p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]"
            >
              <span className="text-[10px] font-bold tracking-widest text-primary/70 uppercase">NAVIGATION</span>
              <span className="text-2xl font-extrabold uppercase tracking-wide">BACK TO PORTAL</span>
            </div>

            {/* Add Applicant Tile */}
            <AddApplicantDialog
              trigger={
                <div className="bg-emerald-500/10 text-emerald-700 p-6 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.99] transition-all min-h-[100px]">
                  <span className="text-[10px] font-bold tracking-widest text-emerald-700/70 uppercase">INCOMING TALENT</span>
                  <span className="text-2xl font-extrabold uppercase tracking-wide">ADD APPLICANT</span>
                </div>
              }
            />
          </div>
        </div>

        {/* TABS */}
        <div className="flex bg-secondary/40 p-1.5 rounded-2xl w-fit gap-1 shadow-sm">
          <button
            onClick={() => setTab('pipeline')}
            className={cn(
              'px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200',
              tab === 'pipeline'
                ? 'bg-card text-primary shadow-sm shadow-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            Pipeline
          </button>
          <button
            onClick={() => setTab('rejected')}
            className={cn(
              'px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200',
              tab === 'rejected'
                ? 'bg-card text-primary shadow-sm shadow-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            Rejected
          </button>
        </div>

        {/* FILTERS & CONTROLS */}
        <div className="bg-card rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border shadow-sm">
          <div className="md:col-span-2 relative flex items-center">
            <Search className="pointer-events-none absolute left-4 size-5 text-muted-foreground/60 z-10" />
            <Input
              placeholder="SEARCH BY NAME, POSITION..."
              className="pl-12 h-12 text-base uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {tab === 'pipeline' && (
            <div className="relative">
              <Select value={status} onValueChange={(v) => setStatus(v as ApplicantStatus | 'all')}>
                <SelectTrigger className="w-full h-12 text-base uppercase">
                  <SelectValue placeholder="FILTER BY STATUS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL STATUSES</SelectItem>
                  <SelectItem value="pending">PENDING</SelectItem>
                  <SelectItem value="interview_scheduled">INTERVIEW SCHEDULED</SelectItem>
                  <SelectItem value="hired">HIRED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* APPLICANTS GRID TABLE */}
        <div className="bg-card rounded-2xl overflow-hidden border shadow-sm">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-secondary/40 rounded-xl" />
              ))}
            </div>
          ) : applicants.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Users2 className="size-16 text-neutral-400" />
              <p className="text-2xl font-black uppercase tracking-wider text-neutral-900">
                {tab === 'rejected' ? 'No rejected applicants' : 'No applicants yet'}
              </p>
              <p className="text-sm text-neutral-500 uppercase tracking-widest">
                {tab === 'rejected'
                  ? 'Applicants you reject will show up here.'
                  : 'Add your first applicant to get started.'}
              </p>
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader className="bg-secondary/40 border-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">NAME</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">POSITION</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">DATE APPLIED</TableHead>
                  <TableHead className="text-muted-foreground font-semibold text-xs uppercase tracking-wider p-4">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="border-0">
                {applicants.map((applicant) => (
                  <TableRow
                    key={applicant._id}
                    className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => navigate(`/applicants/${applicant._id}`)}
                  >
                    <TableCell className="font-semibold text-base text-foreground p-4 uppercase tracking-wider">
                      {applicant.firstName} {applicant.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-foreground/80 p-4 font-medium uppercase">
                      {applicant.positionAppliedFor || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground p-4">
                      {new Date(applicant.dateApplied).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="p-4">
                      <ApplicantStatusBadge status={applicant.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
