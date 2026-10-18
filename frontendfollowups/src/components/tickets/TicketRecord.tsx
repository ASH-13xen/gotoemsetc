import { ArrowRight, Eye, Link2, MessageSquare, Pencil, ShieldCheck, Send, Timer, UserRoundCog } from 'lucide-react'
import type { RecordEntry } from '@/api/tickets.api'
import { RECORD_LABEL, fmtDateTime, fmtDuration, fmtStamp, inkOn } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const ICON: Partial<Record<RecordEntry['type'], typeof Eye>> = {
  seen: Eye,
  commented: MessageSquare,
  link_added: Link2,
  edited: Pencil,
  due_changed: Timer,
  reassigned: UserRoundCog,
  submitted_to_ceo: Send,
  ceo_reviewed: ShieldCheck,
}

const isDateLike = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : isDateLike(v) ? fmtDateTime(v as string) : String(v))

function Chip({ label, color }: { label: string | null; color: string | null }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: color || '#e5e7eb', color: inkOn(color) }}>
      {label}
    </span>
  )
}

// The ticket's permanent record, oldest first: what happened, when (to the
// second), who did it and as what, and the colour it moved into.
export function TicketRecord({ record, hideSeen = false }: { record: RecordEntry[]; hideSeen?: boolean }) {
  const entries = hideSeen ? record.filter((e) => e.type !== 'seen') : record
  return (
    <ol className="relative grid gap-0">
      {entries.map((e, i) => {
        const Icon = ICON[e.type]
        const prev = entries[i - 1]
        const gap = prev ? new Date(e.at).getTime() - new Date(prev.at).getTime() : null
        const isMove = Boolean(e.toLabel) && e.type !== 'seen'
        const dot = e.toColor || (e.type === 'commented' ? '#64748b' : '#cbd5e1')
        return (
          <li key={e._id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
            {i < entries.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-border" />}
            <span className="relative z-10 mt-0.5 grid size-7 place-items-center rounded-full ring-4 ring-card" style={{ background: dot }}>
              {Icon ? <Icon className="size-3.5" style={{ color: inkOn(dot) }} /> : <span className="size-2 rounded-full bg-white/80" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={cn('text-sm font-bold', e.type === 'sent_back' && 'text-pink-600', e.type === 'rejected' && 'text-red-600', e.type === 'overdue' && 'text-slate-600')}>
                  {RECORD_LABEL[e.type] || e.type}
                </p>
                <time className="font-mono text-[11px] text-muted-foreground" dateTime={e.at}>
                  {fmtStamp(e.at)}
                </time>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/85">{e.byName}</span>
                {e.actingAs ? ` · as ${e.actingAs}` : ''}
                {e.onBehalfOf ? ` · on behalf of the ${e.onBehalfOf}` : ''}
                {gap !== null && gap >= 1000 ? <span className="text-muted-foreground/70"> · {fmtDuration(gap)} after the previous entry</span> : null}
              </p>
              {isMove && (e.fromLabel || e.toLabel) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {e.fromLabel && <Chip label={e.fromLabel} color={e.fromColor} />}
                  {e.fromLabel && <ArrowRight className="size-3 text-muted-foreground" />}
                  <Chip label={e.type === 'sent_back' ? `${e.toLabel} · sent back` : e.type === 'rejected' ? 'Rejected' : e.type === 'overdue' ? `${e.toLabel} · overdue` : e.toLabel} color={e.toColor} />
                </div>
              )}
              {e.note && (
                <p className={cn('mt-1.5 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm', e.type === 'commented' ? 'bg-secondary/70' : 'bg-secondary/40 italic text-foreground/80')}>{e.note}</p>
              )}
              {e.changes.length > 0 && (
                <ul className="mt-1.5 grid gap-0.5 text-xs">
                  {e.changes.map((c, j) => (
                    <li key={j}>
                      <span className="font-semibold">{c.field}:</span> <span className="text-muted-foreground line-through decoration-muted-foreground/40">{show(c.from)}</span> <ArrowRight className="inline size-3" /> <span className="font-medium">{show(c.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {e.type === 'link_added' && typeof e.meta?.url === 'string' && (
                <a href={e.meta.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-medium text-primary underline-offset-2 hover:underline">
                  {e.meta.url}
                </a>
              )}
              {e.type === 'raised' && e.meta && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {['pipeline', 'priority', 'team', 'clientName', 'raisedFor'].map((k) =>
                    e.meta?.[k] ? (
                      <span key={k} className="rounded-md bg-secondary/60 px-1.5 py-0.5">
                        {k === 'raisedFor' ? 'for ' : k === 'clientName' ? 'client ' : ''}
                        {String(e.meta[k])}
                      </span>
                    ) : null
                  )}
                  {typeof e.meta.dueAt === 'string' && <span className="rounded-md bg-secondary/60 px-1.5 py-0.5">due {fmtDateTime(e.meta.dueAt)}</span>}
                </div>
              )}
              {e.type === 'completed' && e.meta && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {e.meta.onTime ? 'On time' : 'After its due date'} · took {fmtDuration(Number(e.meta.totalMs))} · {String(e.meta.reverts)} revert(s)
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
