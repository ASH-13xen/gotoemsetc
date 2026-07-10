import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users2 } from 'lucide-react'

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
    <div className="min-h-screen bg-white text-neutral-900 p-6">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-2 border-neutral-900 bg-white">
          {/* Logo/Branding Tile */}
          <div className="md:col-span-2 border-b-2 md:border-b-0 md:border-r-2 border-neutral-900 p-8 flex flex-col justify-between min-h-45">
            <span className="text-xs font-black tracking-widest text-neutral-500 uppercase">RECRUITMENT PIPELINE</span>
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-neutral-900 select-none">
              APPLICANTS
            </h1>
          </div>

          {/* Action Tiles */}
          <div className="grid grid-cols-1 divide-y-2 divide-neutral-900">
            {/* Back to Portal */}
            <div
              onClick={() => navigate('/')}
              className="bg-primary text-primary-foreground p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-30"
            >
              <span className="text-xs font-black tracking-widest opacity-80 uppercase">NAVIGATION</span>
              <span className="text-3xl font-extrabold uppercase tracking-wide">BACK TO PORTAL</span>
            </div>

            {/* Add Applicant Tile */}
            <AddApplicantDialog
              trigger={
                <div className="bg-emerald-600 text-white p-8 flex flex-col justify-between cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all min-h-30">
                  <span className="text-xs font-black tracking-widest opacity-80 uppercase">INCOMING TALENT</span>
                  <span className="text-3xl font-extrabold uppercase tracking-wide">ADD APPLICANT</span>
                </div>
              }
            />
          </div>
        </div>

        {/* TABS */}
        <div className="grid grid-cols-2 border-2 border-neutral-900 bg-white">
          <button
            onClick={() => setTab('pipeline')}
            className={cn(
              'p-4 text-center text-lg font-black uppercase tracking-widest transition-colors',
              tab === 'pipeline' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
            )}
          >
            Pipeline
          </button>
          <button
            onClick={() => setTab('rejected')}
            className={cn(
              'p-4 text-center text-lg font-black uppercase tracking-widest border-l-2 border-neutral-900 transition-colors',
              tab === 'rejected' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
            )}
          >
            Rejected
          </button>
        </div>

        {/* FILTERS & CONTROLS */}
        <div className="border-2 border-neutral-900 bg-white p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative flex items-center">
            <Search className="pointer-events-none absolute left-4 size-5 text-neutral-500 z-10" />
            <Input
              placeholder="SEARCH BY NAME, POSITION..."
              className="pl-12 h-14 text-lg border-2 border-neutral-900 bg-white text-neutral-900 focus:border-primary font-bold placeholder:text-neutral-400 rounded-none uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {tab === 'pipeline' && (
            <div className="relative">
              <Select value={status} onValueChange={(v) => setStatus(v as ApplicantStatus | 'all')}>
                <SelectTrigger className="w-full h-14 text-lg border-2 border-neutral-900 bg-white text-neutral-900 focus:border-primary font-bold rounded-none uppercase">
                  <SelectValue placeholder="FILTER BY STATUS" />
                </SelectTrigger>
                <SelectContent className="border-2 border-neutral-900 bg-white text-neutral-900 rounded-none">
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
        <div className="border-2 border-neutral-900 bg-white overflow-x-auto">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-neutral-200 rounded-none" />
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
            <Table className="border-collapse w-full">
              <TableHeader className="bg-neutral-100 border-b-2 border-neutral-900">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-neutral-900 font-black text-xs uppercase tracking-widest p-4">NAME</TableHead>
                  <TableHead className="text-neutral-900 font-black text-xs uppercase tracking-widest p-4">POSITION</TableHead>
                  <TableHead className="text-neutral-900 font-black text-xs uppercase tracking-widest p-4">DATE APPLIED</TableHead>
                  <TableHead className="text-neutral-900 font-black text-xs uppercase tracking-widest p-4">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y-2 divide-neutral-200">
                {applicants.map((applicant) => (
                  <TableRow
                    key={applicant._id}
                    className="cursor-pointer border-none hover:bg-neutral-100 transition-colors"
                    onClick={() => navigate(`/applicants/${applicant._id}`)}
                  >
                    <TableCell className="font-black text-base text-neutral-900 p-4 uppercase tracking-wider">
                      {applicant.firstName} {applicant.lastName}
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600 p-4 font-bold uppercase">
                      {applicant.positionAppliedFor || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-neutral-500 p-4 font-bold">
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
