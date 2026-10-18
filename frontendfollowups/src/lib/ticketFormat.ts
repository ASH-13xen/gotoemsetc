import type { Priority } from '@/api/tickets.api'

const TZ = 'Asia/Kolkata'

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

// To the second — for the permanent record.
export function fmtStamp(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' })
}

export function fmtDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

// "in 2 days", "3 h overdue"
export function dueText(iso: string, open = true) {
  const diff = new Date(iso).getTime() - Date.now()
  if (!open) return `Due ${fmtDate(iso)}`
  const abs = Math.abs(diff)
  const span = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 172_800_000 ? `${Math.round(abs / 3_600_000)} h` : `${Math.round(abs / 86_400_000)} days`
  return diff < 0 ? `${span} overdue` : `Due in ${span}`
}

export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }
export const PRIORITY_CLASS: Record<Priority, string> = {
  low: 'bg-slate-500/10 text-slate-600',
  normal: 'bg-sky-500/10 text-sky-700',
  high: 'bg-amber-500/15 text-amber-700',
  urgent: 'bg-rose-500/15 text-rose-700',
}

// Dark or light text on a step colour, so every chip stays readable (cream
// and parrot green need dark text, blue and red need white).
export function inkOn(hex: string | null | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#111827'
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#111827' : '#ffffff'
}

export function tint(hex: string | null | undefined, alpha = 0.12) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 'transparent'
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export const RECORD_LABEL: Record<string, string> = {
  raised: 'Raised',
  seen: 'Opened',
  advanced: 'Moved forward',
  restarted: 'Restarted after a revert',
  sent_back: 'Reverted (sent back)',
  rejected: 'Rejected',
  edited: 'Edited',
  due_changed: 'Due date changed',
  reassigned: 'Reassigned',
  commented: 'Comment',
  link_added: 'Link added',
  overdue: 'Went overdue',
  completed: 'Completed',
  submitted_to_ceo: 'Submitted to the CEO',
  ceo_reviewed: 'Reviewed by the CEO',
}
