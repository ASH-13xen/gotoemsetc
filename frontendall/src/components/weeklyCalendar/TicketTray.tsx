import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, GripVertical, Loader2, Ticket } from 'lucide-react'
import type { TrayItem } from '@/api/ticketPlans.api'
import { planKey } from '@/api/ticketPlans.api'
import { cn } from '@/lib/utils'

// "Tickets to plan" — everything waiting on you (tickets at your step, and
// the content calendar's work at your step), overdue first. Under the week
// normally; in full screen a fixed-width column beside it, so a card and the
// day it goes on are both in view. Drag a card onto a day to set time aside
// for it; on a phone, "Plan" puts it at the next free-ish hour. Cards wrap
// and scroll down — never sideways.

export const PLAN_MIME = 'application/x-wc-ticket'
export interface PlanPayload {
  kind: TrayItem['kind']
  ref: string
}

const COLLAPSED_KEY = 'weekly-calendar:tray-collapsed'
const RAIL_COLLAPSED_KEY = 'weekly-calendar:rail-collapsed'

// Folded or open, remembered per place (under the week / the full-screen column).
function useFolded(key: string) {
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setFolded((v) => {
      try {
        localStorage.setItem(key, v ? '0' : '1')
      } catch {
        // storage may be unavailable — it just opens next time
      }
      return !v
    })
  return [folded, toggle] as const
}

export function dueText(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`)

interface TrayProps {
  items: TrayItem[]
  loading: boolean
  // Minutes planned this week, by planKey.
  planned: Map<string, number>
  // False on a past week — nothing can be planned there.
  canPlan: boolean
  onPlan: (item: TrayItem) => void
}

function TrayCard({ item, planned, canPlan, onPlan }: { item: TrayItem; planned: number; canPlan: boolean; onPlan: (item: TrayItem) => void }) {
  return (
    <div
      draggable={canPlan}
      onDragStart={(e) => {
        e.dataTransfer.setData(PLAN_MIME, JSON.stringify({ kind: item.kind, ref: item._id } satisfies PlanPayload))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      data-tray-item={planKey(item.kind, item._id)}
      className={cn(
        'group relative flex min-w-0 gap-2 overflow-hidden rounded-2xl border border-border bg-background py-2.5 pr-2.5 pl-3.5 transition-shadow',
        canPlan && 'cursor-grab hover:shadow-md active:cursor-grabbing'
      )}
      title={canPlan ? 'Drag onto the week' : undefined}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: item.color }} />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-black tracking-wide text-muted-foreground">
          <span className="truncate font-mono text-foreground">{item.code}</span>
          {item.stageLabel && (
            <span className="truncate rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: item.color }}>
              {item.stageLabel}
            </span>
          )}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-semibold break-words text-foreground">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {item.nextStepLabel && <span className="truncate">Next: {item.nextStepLabel}</span>}
          <span className={cn('font-semibold', item.isOverdue ? 'text-rose-600' : '')}>
            {item.isOverdue ? 'Overdue · ' : 'Due '}
            {dueText(item.dueAt)}
          </span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', planned ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-secondary text-muted-foreground')}>
            {planned ? `${hm(planned)} planned this week` : 'Not planned this week'}
          </span>
          <button
            type="button"
            disabled={!canPlan}
            onClick={() => onPlan(item)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            <CalendarPlus className="size-3" /> Plan
          </button>
          <Link to={item.link} className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground" title="Open it">
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
      {canPlan && <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />}
    </div>
  )
}

function Cards({ items, loading, planned, canPlan, onPlan, className }: TrayProps & { className: string }) {
  if (items.length === 0) return <p className="px-3 py-4 text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'Nothing is waiting on you.'}</p>
  return (
    <div className={cn('grid content-start gap-2 overflow-x-hidden overflow-y-auto overscroll-contain', className)}>
      {items.map((item) => (
        <TrayCard key={planKey(item.kind, item._id)} item={item} planned={planned.get(planKey(item.kind, item._id)) ?? 0} canPlan={canPlan} onPlan={onPlan} />
      ))}
    </div>
  )
}

// Under the week.
export function TicketTray(props: TrayProps) {
  const { items, loading, planned, canPlan } = props
  const [collapsed, toggle] = useFolded(COLLAPSED_KEY)
  const unplanned = items.filter((i) => !planned.get(planKey(i.kind, i._id))).length

  return (
    <section className="wc-card mt-4 overflow-hidden rounded-3xl border border-border bg-card" aria-label="Tickets to plan">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={!collapsed}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Ticket className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">
            Tickets to plan{items.length ? ` · ${items.length}` : ''}
            {unplanned > 0 && unplanned < items.length && <span className="font-semibold text-muted-foreground"> · {unplanned} not planned this week</span>}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {canPlan ? 'Drag one onto a day to set time aside for it — only you see these.' : 'A past week — move to this week or a later one to plan.'}
          </span>
        </span>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
      </button>
      {!collapsed && (
        <div className="border-t border-border p-3">
          <Cards {...props} className="max-h-72 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" />
        </div>
      )}
    </section>
  )
}

// In full screen: a fixed-width column beside the week, as tall as it, with
// its own scroll — folds to a thin strip to give the week the room.
export function TicketRail(props: TrayProps) {
  const { items, loading, canPlan } = props
  const [collapsed, toggle] = useFolded(RAIL_COLLAPSED_KEY)
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={`Show tickets to plan (${items.length})`}
        title="Show tickets to plan"
        className="wc-card flex w-11 shrink-0 flex-col items-center gap-2 self-start rounded-3xl border border-border bg-card py-3 text-muted-foreground hover:text-foreground"
      >
        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Ticket className="size-4" />
        </span>
        <span className="text-xs font-black tabular-nums">{items.length}</span>
        <ChevronRight className="size-4" />
      </button>
    )
  }
  return (
    <section aria-label="Tickets to plan" className="wc-card flex max-h-[calc(100vh-8.5rem)] w-72 shrink-0 flex-col self-start overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-start gap-2 border-b border-border px-3 py-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
          <Ticket className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">Tickets to plan{items.length ? ` · ${items.length}` : ''}</span>
          <span className="block text-[11px] leading-snug text-muted-foreground">{canPlan ? 'Drag one onto a day.' : 'A past week — nothing to plan here.'}</span>
        </span>
        {loading && <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" />}
        <button type="button" onClick={toggle} aria-label="Fold tickets to plan" title="Fold" className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <Cards {...props} className="min-h-0 flex-1 p-2.5" />
    </section>
  )
}
