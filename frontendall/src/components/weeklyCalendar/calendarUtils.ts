import gsap from 'gsap'
import type { BusyInterval, CalPerson, Occurrence, WeekGridConfig, WeeklyCategory } from '@/api/weeklyCalendar.api'

// An empty week has nothing to animate — that's fine, not worth a warning.
gsap.config({ nullTargetWarn: false })

// ---------------------------------------------------------------------------
// Days are 'YYYY-MM-DD' strings and times are minutes since midnight, both
// in IST — exactly what the server stores, so nothing drifts across zones.
// ---------------------------------------------------------------------------

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function mondayOf(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addDays(day, dow === 0 ? -6 : 1 - dow)
}

export function nowIst() {
  const shifted = new Date(Date.now() + 330 * 60_000)
  return { day: shifted.toISOString().slice(0, 10), min: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
}

export function fmtMin(min: number, withSuffix = true) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${withSuffix ? (h >= 12 ? ' pm' : ' am') : ''}`
}

// "9:00 – 10:30 am", or "11:30 am – 12:30 pm" when it crosses noon.
export function fmtRange(start: number, end: number) {
  const sameHalf = start < 720 === end < 720
  return sameHalf ? `${fmtMin(start, false)} – ${fmtMin(end)}` : `${fmtMin(start)} – ${fmtMin(end)}`
}

const asDate = (day: string) => new Date(`${day}T00:00:00Z`)
export const dowShort = (day: string) => asDate(day).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()
export const ddmmyy = (day: string) => {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y.slice(2)}`
}
export const fmtDay = (day: string) => asDate(day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
export const fmtDayLong = (day: string) =>
  asDate(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const fmtWhen = (o: Occurrence) => `${fmtDay(o.day)} · ${fmtRange(o.startMin, o.endMin)}`

export function weekLabel(start: string) {
  const end = addDays(start, 6)
  const a = asDate(start)
  const b = asDate(end)
  const sameMonth = a.getUTCMonth() === b.getUTCMonth()
  const left = a.toLocaleDateString('en-IN', { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }), timeZone: 'UTC' })
  const right = b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return `${left} – ${right}`
}

export const overlaps = (a: Occurrence, b: Occurrence) => a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin

export const DEFAULT_GRID: WeekGridConfig = { START: 390, END: 1230, SLOT: 30, LUNCH_START: 810, LUNCH_END: 870 }
export const EARLY_END = 540 // 9:00 am — the template's first block ends here
export const LATE_START = 1110 // 6:30 pm — the template's last block starts here

export const isLunch = (min: number, grid: WeekGridConfig) => min >= grid.LUNCH_START && min < grid.LUNCH_END

// ---------------------------------------------------------------------------
// Categories — colours lifted from the CEO planner PDF, in a modern finish.
// ---------------------------------------------------------------------------

export const CATEGORY: Record<WeeklyCategory, { label: string; from: string; to: string; soft: string; ink: string }> = {
  team: { label: 'Team meeting', from: '#22c55e', to: '#14b8a6', soft: 'rgba(34,197,94,0.14)', ink: '#15803d' },
  sales: { label: 'Sales', from: '#3b82f6', to: '#6366f1', soft: 'rgba(59,130,246,0.14)', ink: '#1d4ed8' },
  hr: { label: 'HR', from: '#f97316', to: '#f59e0b', soft: 'rgba(249,115,22,0.14)', ink: '#c2410c' },
  client: { label: 'Client / external', from: '#f43f5e', to: '#e11d48', soft: 'rgba(244,63,94,0.14)', ink: '#be123c' },
  event: { label: 'Event', from: '#eab308', to: '#f59e0b', soft: 'rgba(234,179,8,0.16)', ink: '#a16207' },
  training: { label: 'Training', from: '#06b6d4', to: '#0ea5e9', soft: 'rgba(6,182,212,0.14)', ink: '#0e7490' },
  admin: { label: 'Admin work', from: '#d946ef', to: '#ec4899', soft: 'rgba(217,70,239,0.13)', ink: '#a21caf' },
  other: { label: 'Other', from: '#64748b', to: '#475569', soft: 'rgba(100,116,139,0.13)', ink: '#334155' },
}
export const PERSONAL = { label: 'Personal', from: '#8b5cf6', to: '#a855f7', soft: 'rgba(139,92,246,0.14)', ink: '#6d28d9' }

export const CATEGORY_KEYS = Object.keys(CATEGORY) as WeeklyCategory[]

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const AVATAR_GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#22d3ee'],
  ['#f43f5e', '#fb7185'],
  ['#f59e0b', '#fbbf24'],
  ['#10b981', '#34d399'],
  ['#ec4899', '#f472b6'],
  ['#8b5cf6', '#c084fc'],
  ['#14b8a6', '#5eead4'],
]

export function avatarGradient(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const [a, b] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

export function initialsOf(person: Pick<CalPerson, 'name'>) {
  const parts = person.name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? ''))).toUpperCase()
}

export const firstName = (person: Pick<CalPerson, 'name'>) => person.name.split(' ')[0]

export type Availability = { state: 'free' } | { state: 'tentative'; title: string | null } | { state: 'busy' | 'leave'; title: string | null; when: Occurrence }

// Is this person free for every one of `occurrences`? Pending invites don't
// count against them — they only show as "tentative".
export function availabilityFor(intervals: BusyInterval[] | undefined, occurrences: Occurrence[], ignoreEventId?: string): Availability {
  let tentative: Availability | null = null
  for (const o of occurrences) {
    for (const b of intervals ?? []) {
      if (b.eventId && b.eventId === ignoreEventId) continue
      if (!overlaps(b, o)) continue
      if (b.kind === 'leave') return { state: 'leave', title: null, when: o }
      if (b.kind === 'event') return { state: 'busy', title: b.title, when: o }
      tentative ??= { state: 'tentative', title: b.title }
    }
  }
  return tentative ?? { state: 'free' }
}

// Which Mondays a set of occurrences touches — for fetching busy maps.
export const weeksOf = (occurrences: Occurrence[]) => [...new Set(occurrences.map((o) => mondayOf(o.day)))].sort()

export function expandRepeats(slots: Occurrence[], repeatWeeks: number) {
  const out: Occurrence[] = []
  for (let w = 0; w <= repeatWeeks; w += 1) for (const s of slots) out.push({ ...s, day: addDays(s.day, 7 * w) })
  return out
}

export function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}
