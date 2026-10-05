import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Crown,
  Info,
  KeyRound,
  Landmark,
  ShieldCheck,
  User,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'

import { apiClient } from '@/api/client'
import { cn } from '@/lib/utils'
import { hasRole } from '@/lib/access'
import type { StoredUser } from '@/lib/authStorage'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useKeys } from '@/hooks/useKeys'
import { KEY_LABEL } from '@/api/keys.api'

// ---------------------------------------------------------------------------
// One dashboard per hat a person wears. Someone who is an employee AND holds
// the HR post sees a big toggle: "My dashboard" | "HR". Role logins with no
// employee record only get their role's view. Which views exist follows the
// person's live roles (login + Organisation chart posts).
// ---------------------------------------------------------------------------

export type DashboardView = 'me' | 'admin' | 'ceo' | 'hr' | 'cfo' | 'operations'

export const VIEW_META: Record<DashboardView, { label: string; icon: typeof User; gradient: string }> = {
  me: { label: 'My dashboard', icon: User, gradient: 'from-indigo-500 to-violet-500' },
  admin: { label: 'Admin', icon: ShieldCheck, gradient: 'from-slate-700 to-slate-500' },
  ceo: { label: 'CEO', icon: Crown, gradient: 'from-amber-500 to-orange-500' },
  hr: { label: 'HR', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
  cfo: { label: 'Finance', icon: Wallet, gradient: 'from-sky-500 to-blue-600' },
  operations: { label: 'Operations', icon: Wrench, gradient: 'from-rose-500 to-pink-500' },
}

export function availableViews(user: StoredUser | null | undefined): DashboardView[] {
  const views: DashboardView[] = []
  if (user?.employeeLink) views.push('me')
  if (hasRole(user, 'admin')) views.push('admin')
  if (hasRole(user, 'ceo')) views.push('ceo')
  if (hasRole(user, 'hr')) views.push('hr')
  if (hasRole(user, 'cfo', 'finance')) views.push('cfo')
  if (hasRole(user, 'operations_manager')) views.push('operations')
  if (views.length === 0) views.push('me')
  return views
}

export function DashboardToggle({ views, value, onChange }: { views: DashboardView[]; value: DashboardView; onChange: (v: DashboardView) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  // The coloured pill glides to the chosen view.
  useLayoutEffect(() => {
    const bar = barRef.current
    const pill = pillRef.current
    const target = bar?.querySelector<HTMLButtonElement>(`[data-view="${value}"]`)
    if (!bar || !pill || !target) return
    gsap.to(pill, {
      x: target.offsetLeft,
      width: target.offsetWidth,
      duration: 0.45,
      ease: 'power3.out',
    })
  }, [value, views.length])

  if (views.length < 2) return null
  return (
    <div className="dashboard-header">
      <div ref={barRef} className="relative inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
        <span
          ref={pillRef}
          className={cn('pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-xl bg-gradient-to-r shadow-md', VIEW_META[value].gradient)}
          style={{ width: 0 }}
        />
        {views.map((v) => {
          const Icon = VIEW_META[v].icon
          const active = v === value
          return (
            <button
              key={v}
              type="button"
              data-view={v}
              onClick={() => onChange(v)}
              className={cn(
                'relative z-10 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors duration-200',
                active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              {VIEW_META[v].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---- CEO: approvals waiting on the CEO ----

interface PendingRequest {
  _id: string
  approvalStage: string
  date: string
  endDate: string
  reason: string
  employee: { firstName: string; lastName?: string } | string
}

export function CeoLeaveApprovalsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-requests', 'ceo-stage'],
    queryFn: async () => (await apiClient.get<{ requests: PendingRequest[] }>('/attendance-requests', { params: { status: 'pending' } })).data.requests,
    refetchInterval: 60_000,
  })
  const waiting = (data ?? []).filter((r) => r.approvalStage === 'ceo')
  const name = (r: PendingRequest) => (typeof r.employee === 'string' ? r.employee : `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim().toLowerCase())
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return (
    <DashboardCard
      icon={<Crown className="size-4" />}
      title={`Leave waiting for the CEO${waiting.length ? ` · ${waiting.length}` : ''}`}
      viewAllHref="/hr"
      viewAllLabel="Open HR Work"
      headerRight={
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="What this card shows"
              className="mr-auto flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Info className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 text-xs leading-relaxed text-muted-foreground">
            <p className="text-sm font-bold text-foreground">What this card shows</p>
            <p className="mt-2">
              Leave requests that are waiting for the <b className="text-foreground">final approval</b> — the last step, after HR has
              already approved them.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                Only <b className="text-foreground">Unpaid Leave</b> comes here. It goes Content Manager → HR → CEO. Every other type
                (Short Leave, Late, Half Day, Work From Home, Paid Leave) ends with HR and never appears on this card.
              </li>
              <li>Each row shows the employee, their reason and the dates. Up to six are listed; the number in the title is the total.</li>
              <li>
                Nothing is decided from this card. Click a row or <b className="text-foreground">Open HR Work</b> to approve or reject
                it there.
              </li>
              <li>The CEO or the admin can give this approval — whoever does it first settles it. Nobody approves their own leave.</li>
              <li>“Nothing waiting for your final approval” means no Unpaid Leave is at this step right now.</li>
            </ul>
          </PopoverContent>
        </Popover>
      }
    >
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : waiting.length === 0 ? (
        <DashboardCardEmpty icon={<Crown className="size-4" />} message="Nothing waiting for your final approval." />
      ) : (
        <div className="grid gap-2">
          {waiting.slice(0, 6).map((r) => (
            <Link key={r._id} to="/hr" className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/8 p-3 transition-colors hover:bg-amber-500/15">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground capitalize">{name(r)}</p>
                <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-300">
                {r.date.slice(0, 10) === r.endDate?.slice(0, 10) ? fmt(r.date) : `${fmt(r.date)} – ${fmt(r.endDate)}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}

// ---- Finance (CFO) ----

function Metric({ label, value, href, tone }: { label: string; value: number | undefined; href: string; tone: string }) {
  return (
    <Link
      to={href}
      className="dashboard-card group flex flex-col rounded-2xl border border-border bg-card p-5 transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-[0_8px_24px_-12px_oklch(0.52_0.16_265/0.25)]"
    >
      {value === undefined ? (
        <Skeleton className="h-10 w-14 rounded-lg" />
      ) : (
        <p className={cn('text-4xl leading-none font-black tracking-tighter tabular-nums', tone)}>{value}</p>
      )}
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {label}
        <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
    </Link>
  )
}

const count = async (path: string, params?: Record<string, string>, key?: string) => {
  const { data } = await apiClient.get(path, { params })
  const list = key ? data[key] : Object.values(data).find(Array.isArray)
  return Array.isArray(list) ? list : []
}

export function FinanceDashboard() {
  const claims = useQuery({ queryKey: ['finance-dash', 'claims'], queryFn: () => count('/reimbursements', { status: 'pending' }) })
  const toPay = useQuery({ queryKey: ['finance-dash', 'to-pay'], queryFn: () => count('/reimbursements', { status: 'approved' }) })
  const fnf = useQuery({ queryKey: ['finance-dash', 'fnf'], queryFn: () => count('/fnf-settlements') })
  const bills = useQuery({ queryKey: ['finance-dash', 'bills'], queryFn: () => count('/monthly-bills') })
  const invoices = useQuery({ queryKey: ['finance-dash', 'invoices'], queryFn: () => count('/invoices') })

  const unpaidFnf = fnf.data?.filter((f: { status?: string }) => f.status !== 'paid').length
  const dueBills = bills.data?.reduce(
    (sum: number, b: { instances?: { status?: string }[] }) => sum + (b.instances ?? []).filter((i) => i.status === 'due').length,
    0
  )
  const pendingInvoices = invoices.data?.filter((i: { status?: string }) => i.status && !['paid', 'cancelled'].includes(i.status)).length

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold tracking-widest text-muted-foreground/70 uppercase">Finance at a glance</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Metric label="Claims to approve" value={claims.data?.length} href="/finance" tone="text-amber-600 dark:text-amber-400" />
        <Metric label="Reimbursements to pay" value={toPay.data?.length} href="/finance" tone="text-sky-600 dark:text-sky-400" />
        <Metric label="Bills due" value={dueBills} href="/finance" tone="text-rose-600 dark:text-rose-400" />
        <Metric label="Open invoices" value={pendingInvoices} href="/finance" tone="text-indigo-600 dark:text-indigo-400" />
        <Metric label="F&F to settle" value={unpaidFnf} href="/finance" tone="text-emerald-600 dark:text-emerald-400" />
      </div>
      <Link
        to="/finance"
        className="dashboard-card flex items-center justify-between rounded-2xl border border-border bg-gradient-to-r from-sky-500/10 to-blue-600/10 p-5 transition-colors hover:from-sky-500/15"
      >
        <span className="flex items-center gap-3 text-sm font-bold">
          <Landmark className="size-5 text-sky-600" /> Open Finance — salaries, F&F, invoices, bills and reimbursements
        </span>
        <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

// ---- Operations ----

interface ComplaintRow {
  _id: string
  category: string
  description: string
  status: string
  createdAt: string
  employee?: { firstName: string; lastName?: string }
}

export function OperationsDashboard() {
  const complaints = useQuery({
    queryKey: ['ops-dash', 'complaints'],
    queryFn: async () => (await apiClient.get<{ complaints: ComplaintRow[] }>('/complaints')).data.complaints,
  })
  const { data: keysData, isLoading: keysLoading } = useKeys()
  const open = (complaints.data ?? []).filter((c) => c.status === 'pending')

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <DashboardCard icon={<AlertTriangle className="size-4" />} title={`Open complaints${open.length ? ` · ${open.length}` : ''}`} viewAllHref="/operations" viewAllLabel="Open Operations">
        {complaints.isLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : open.length === 0 ? (
          <DashboardCardEmpty icon={<AlertTriangle className="size-4" />} message="No open complaints." />
        ) : (
          <div className="grid max-h-96 gap-2 overflow-y-auto pr-0.5">
            {open.slice(0, 10).map((c) => (
              <Link key={c._id} to="/operations" className="rounded-xl bg-rose-500/6 p-3 transition-colors hover:bg-rose-500/12">
                <p className="text-sm font-semibold text-foreground capitalize">{c.category.replace(/_/g, ' ')}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              </Link>
            ))}
          </div>
        )}
      </DashboardCard>
      <DashboardCard icon={<KeyRound className="size-4" />} title="Office keys">
        {keysLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : (
          <div className="grid gap-2">
            {(keysData?.keys ?? []).map((k) => (
              <div key={k.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                <span className="flex items-center gap-2 text-sm font-semibold uppercase">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {KEY_LABEL[k.key]}
                </span>
                <span className="truncate text-xs text-muted-foreground capitalize">
                  {k.holders.length ? k.holders.map((h) => `${h.firstName} ${h.lastName ?? ''}`.trim().toLowerCase()).join(', ') : 'Unassigned'}
                </span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
