import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GENUINE_LABEL,
  GENUINE_PARTS,
  PARTS,
  locationItemsFor,
  securityItemsFor,
  securityLabel,
  type DeviceCheck,
  type DeviceKind,
  type Settings,
} from '@/api/devices.api'

// A device's checks over time: storage and battery as lines, and a grid of
// everything each check found, where a ring marks what changed since the
// check before. Each check row also lists its changes (CheckChanges).

const KIND_SHORT = { handover: 'Handover', return: 'Return', monthly: 'Monthly', adhoc: 'HR check' } as const
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const map = <T,>(m?: Record<string, T> | Map<string, T> | null): Record<string, T> => (m instanceof Map ? Object.fromEntries(m) : m ?? {})

const freePct = (c: DeviceCheck) =>
  c.storageTotalGb && c.storageFreeGb != null && c.storageTotalGb > 0 ? Math.round((c.storageFreeGb / c.storageTotalGb) * 100) : null

// Every check except one sent back (it was done again), oldest first.
export function timeline(checks: DeviceCheck[]) {
  return [...checks].filter((c) => c.status !== 'rejected').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
}

// ---------------------------------------------------------------- what changed

type Level = 'good' | 'warn' | 'bad' | null
interface Row {
  group: string
  key: string
  label: string
  // Each check's state: a short text and how good it is.
  read: (c: DeviceCheck) => { text: string; level: Level; score: number } | null
}

const PART_SCORE = { ok: 0, worn: 1, damaged: 2, missing: 2 } as const
const PART_TEXT = { ok: 'OK', worn: 'Worn', damaged: 'Damaged', missing: 'Missing' } as const
const GRADE_SCORE = { A: 0, B: 1, C: 2, D: 3 } as const

function rowsFor(kind: DeviceKind, os: string | null | undefined, apps: Settings['apps']): Row[] {
  const rows: Row[] = [
    {
      group: 'Condition',
      key: 'grade',
      label: 'Overall grade',
      read: (c) => (c.grade ? { text: c.grade, level: c.grade === 'D' ? 'bad' : c.grade === 'C' ? 'warn' : 'good', score: GRADE_SCORE[c.grade] } : null),
    },
  ]
  for (const p of PARTS[kind]) {
    rows.push({
      group: 'Parts',
      key: `part:${p.key}`,
      label: p.label,
      read: (c) => {
        const s = map(c.parts)[p.key]
        return s ? { text: PART_TEXT[s], level: s === 'ok' ? 'good' : s === 'worn' ? 'warn' : 'bad', score: PART_SCORE[s] } : null
      },
    })
  }
  if (os === 'ios') {
    for (const p of GENUINE_PARTS) {
      rows.push({
        group: 'Parts and service history',
        key: `genuine:${p.key}`,
        label: p.label,
        read: (c) => {
          const s = map(c.genuine)[p.key]
          return s ? { text: GENUINE_LABEL[s], level: s === 'unknown' ? 'bad' : 'good', score: s === 'unknown' ? 1 : 0 } : null
        },
      })
    }
  }
  for (const item of locationItemsFor(kind)) {
    rows.push({ group: 'Location', key: `loc:${item.key}`, label: item.short, read: (c) => onOff(map(c.location)[item.key]) })
  }
  for (const item of securityItemsFor(kind)) {
    rows.push({ group: 'Security', key: `sec:${item.key}`, label: securityLabel(item.key), read: (c) => onOff(map(c.security)[item.key]) })
  }
  if (kind === 'phone' || kind === 'tablet') {
    for (const app of apps) {
      rows.push({
        group: 'Apps',
        key: `app:${app.key}`,
        label: app.label,
        read: (c) => {
          if (!c.apps?.length) return null
          const a = c.apps.find((x) => x.key === app.key)
          if (a?.installed && a.loggedIn) return { text: 'Signed in', level: 'good', score: 0 }
          if (a?.installed) return { text: 'Not signed in', level: 'warn', score: 1 }
          return { text: 'Missing', level: app.required ? 'bad' : 'warn', score: 2 }
        },
      })
    }
  }
  return rows
}

function onOff(v: boolean | undefined) {
  return v === undefined ? null : { text: v ? 'On' : 'Off', level: (v ? 'good' : 'bad') as Level, score: v ? 0 : 1 }
}

export interface Change {
  label: string
  from: string
  to: string
  better: boolean | null
}

// What changed from one check to the next: storage and battery, then every
// row whose state is different.
export function checkChanges(prev: DeviceCheck, cur: DeviceCheck, kind: DeviceKind, os: string | null | undefined, apps: Settings['apps']): Change[] {
  const out: Change[] = []
  const pf = freePct(prev)
  const cf = freePct(cur)
  if (pf != null && cf != null && Math.abs(cf - pf) >= 1) out.push({ label: 'Free storage', from: `${pf}%`, to: `${cf}%`, better: cf > pf })
  if (prev.batteryHealth != null && cur.batteryHealth != null && prev.batteryHealth !== cur.batteryHealth)
    out.push({ label: 'Battery health', from: `${prev.batteryHealth}%`, to: `${cur.batteryHealth}%`, better: cur.batteryHealth > prev.batteryHealth })
  for (const row of rowsFor(kind, os, apps)) {
    const a = row.read(prev)
    const b = row.read(cur)
    if (!a || !b || a.text === b.text) continue
    out.push({ label: row.label, from: a.text, to: b.text, better: a.score === b.score ? null : b.score < a.score })
  }
  return out
}

export function CheckChanges({ changes }: { changes: Change[] }) {
  if (!changes.length) return <p className="text-xs text-muted-foreground">Nothing changed since the check before.</p>
  return (
    <ul className="grid gap-1 text-xs">
      {changes.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5">
          {c.better === true ? (
            <ArrowUpRight className="size-3.5 shrink-0 text-emerald-600" aria-label="Better" />
          ) : c.better === false ? (
            <ArrowDownRight className="size-3.5 shrink-0 text-destructive" aria-label="Worse" />
          ) : (
            <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-label="Changed" />
          )}
          <span className="text-foreground">{c.label}:</span>
          <span className="text-muted-foreground">{c.from}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-semibold text-foreground">{c.to}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- the lines

const W = 640
const H = 210
const PAD = { l: 40, r: 112, t: 14, b: 30 }
const SERIES = [
  { key: 'battery', label: 'Battery health', stroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]', fill: 'fill-[#2a78d6] dark:fill-[#3987e5]', bg: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { key: 'storage', label: 'Free storage', stroke: 'stroke-[#eb6834] dark:stroke-[#d95926]', fill: 'fill-[#eb6834] dark:fill-[#d95926]', bg: 'bg-[#eb6834] dark:bg-[#d95926]' },
] as const

function LinesChart({ list }: { list: DeviceCheck[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const values = list.map((c) => ({ battery: c.batteryHealth ?? null, storage: freePct(c) }))
  const x = (i: number) => PAD.l + (list.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (list.length - 1))
  const y = (v: number) => PAD.t + ((100 - v) * (H - PAD.t - PAD.b)) / 100
  const path = (k: 'battery' | 'storage') => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      const val = v[k]
      if (val == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`
      pen = true
    })
    return d
  }
  // Direct labels at the line ends, only where they don't collide.
  const last = (k: 'battery' | 'storage') => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i][k] != null) return { i, v: values[i][k] as number }
    return null
  }
  const ends = { battery: last('battery'), storage: last('storage') }
  const labelsFit = !ends.battery || !ends.storage || Math.abs(y(ends.battery.v) - y(ends.storage.v)) >= 14

  const onMove = (e: ReactPointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let best = 0
    list.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    })
    setHover(best)
  }
  const tipLeft = hover == null ? 0 : (x(hover) / W) * 100

  return (
    <div ref={wrap} className="relative">
      <div className="mb-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn('h-0.5 w-4 rounded', s.bg)} />
            {s.label} (%)
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Battery health and free storage at each check, in percent">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {t}%
            </text>
          </g>
        ))}
        {list.map((c, i) => (
          <text key={c._id} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {list.length > 8 && i % 2 === 1 && i !== list.length - 1 ? '' : day(c.createdAt)}
          </text>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="stroke-muted-foreground/60" strokeWidth={1} />}
        {SERIES.map((s) => (
          <g key={s.key}>
            <path d={path(s.key)} className={cn('fill-none', s.stroke)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) =>
              v[s.key] == null ? null : (
                <circle key={i} cx={x(i)} cy={y(v[s.key] as number)} r={hover === i ? 5 : 4} className={cn(s.fill, 'stroke-card')} strokeWidth={2} />
              )
            )}
          </g>
        ))}
        {labelsFit &&
          SERIES.map((s) => {
            const e = ends[s.key]
            if (!e) return null
            return (
              <text key={s.key} x={x(e.i) + 9} y={y(e.v) + 3} className="fill-foreground text-[11px]">
                <tspan className="font-semibold">{e.v}%</tspan>
                <tspan className="fill-muted-foreground"> {s.key === 'battery' ? 'battery' : 'free'}</tspan>
              </text>
            )
          })}
        <rect x={PAD.l - 10} y={PAD.t} width={W - PAD.l - PAD.r + 20} height={H - PAD.t - PAD.b} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `${Math.min(80, Math.max(18, tipLeft))}%` }}
        >
          <p className="mb-1 text-muted-foreground">
            {day(list[hover].createdAt)} · {KIND_SHORT[list[hover].kind]} · grade {list[hover].grade ?? '—'}
          </p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-2">
              <span className={cn('h-0.5 w-3 rounded', s.bg)} />
              <span className="font-semibold text-foreground tabular-nums">{values[hover][s.key] != null ? `${values[hover][s.key]}%` : '—'}</span>
              <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the grid

const LEVEL_STYLE: Record<'good' | 'warn' | 'bad', string> = {
  good: 'bg-[#0ca30c] text-white',
  warn: 'bg-[#fab219] text-[#0b0b0b]',
  bad: 'bg-[#d03b3b] text-white',
}
const LEVEL_ICON = { good: Check, warn: Minus, bad: X }

function FindingsGrid({ list, rows, onlyChanged }: { list: DeviceCheck[]; rows: Row[]; onlyChanged: boolean }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const cells = rows
    .map((row) => {
      const states = list.map((c) => row.read(c))
      const changed = states.map((s, i) => {
        if (!s || i === 0) return false
        for (let j = i - 1; j >= 0; j--) if (states[j]) return states[j]!.text !== s.text
        return false
      })
      return { row, states, changed }
    })
    .filter((r) => r.states.some(Boolean) && (!onlyChanged || r.changed.some(Boolean)))
  if (!cells.length) return <p className="py-3 text-xs text-muted-foreground">{onlyChanged ? 'Nothing has changed between checks.' : 'No findings yet.'}</p>
  let lastGroup = ''
  const show = (e: React.PointerEvent, text: string) => {
    const r = box.current?.getBoundingClientRect()
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text })
  }
  return (
    <div ref={box} className="relative overflow-x-auto" onPointerLeave={() => setTip(null)}>
      <table className="border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th />
            {list.map((c) => (
              <th key={c._id} className="px-0.5 pb-1 text-center font-normal whitespace-nowrap text-muted-foreground">
                <div>{day(c.createdAt)}</div>
                <div className="text-[10px]">{KIND_SHORT[c.kind]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map(({ row, states, changed }) => {
            const heading = row.group !== lastGroup
            lastGroup = row.group
            return [
              heading && (
                <tr key={`${row.group}-h`}>
                  <td colSpan={list.length + 1} className="pt-2 text-[11px] font-semibold text-muted-foreground">
                    {row.group}
                  </td>
                </tr>
              ),
              <tr key={row.key}>
                <td className="pr-3 whitespace-nowrap text-foreground">{row.label}</td>
                {states.map((s, i) => {
                  const Icon = s?.level ? LEVEL_ICON[s.level] : null
                  const was = changed[i] ? states.slice(0, i).reverse().find(Boolean) : null
                  const text = `${row.label} — ${day(list[i].createdAt)} (${KIND_SHORT[list[i].kind]}): ${s ? s.text : 'not checked'}${was ? `, was ${was.text}` : ''}`
                  return (
                    <td key={list[i]._id} className="p-0 text-center">
                      <span
                        aria-label={text}
                        onPointerMove={(e) => show(e, text)}
                        className={cn(
                          'mx-auto flex size-5 items-center justify-center rounded',
                          s?.level ? LEVEL_STYLE[s.level] : 'border border-border',
                          changed[i] && 'ring-2 ring-foreground ring-offset-1 ring-offset-card'
                        )}
                      >
                        {row.key === 'grade' && s ? <span className="text-[10px] font-bold">{s.text}</span> : Icon && <Icon className="size-3" strokeWidth={3} />}
                      </span>
                    </td>
                  )
                })}
              </tr>,
            ]
          })}
        </tbody>
      </table>
      {tip && (
        <div className="pointer-events-none absolute z-10 max-w-72 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-md" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.text}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- together

export function CheckHistory({ checks, kind, os, apps }: { checks: DeviceCheck[]; kind: DeviceKind; os?: string | null; apps: Settings['apps'] }) {
  const list = useMemo(() => timeline(checks).slice(-12), [checks])
  const rows = useMemo(() => rowsFor(kind, os, apps), [kind, os, apps])
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  if (!list.length) return <p className="text-xs text-muted-foreground">No checks yet — the history starts with the handover check.</p>
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {list.length === 1 ? 'One check so far — the lines start with the second.' : `The last ${list.length} checks, oldest on the left.`}
        </p>
        <div className="flex gap-1 text-xs">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn('rounded-md px-2 py-1', view === v ? 'bg-secondary font-semibold text-foreground' : 'text-muted-foreground hover:bg-secondary/60')}
            >
              {v === 'chart' ? 'Graph' : 'Table'}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? (
        <LinesChart list={list} />
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Check</th>
              <th className="font-normal">Grade</th>
              <th className="font-normal">Free storage</th>
              <th className="font-normal">Battery health</th>
              <th className="font-normal">Problems found</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c._id} className="border-t border-border">
                <td className="py-1">
                  {day(c.createdAt)} · {KIND_SHORT[c.kind]}
                </td>
                <td>{c.grade ?? '—'}</td>
                <td className="tabular-nums">{freePct(c) != null ? `${freePct(c)}%` : '—'}</td>
                <td className="tabular-nums">{c.batteryHealth != null ? `${c.batteryHealth}%` : '—'}</td>
                <td className="tabular-nums">{c.flags?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">What each check found</p>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" className="accent-primary" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
            Only what changed
          </label>
        </div>
        <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(
            [
              ['good', 'OK · on · signed in · genuine'],
              ['warn', 'Worn · not signed in'],
              ['bad', 'Damaged · missing · off · unknown part'],
            ] as const
          ).map(([lvl, label]) => {
            const Icon = LEVEL_ICON[lvl]
            return (
              <span key={lvl} className="flex items-center gap-1">
                <span className={cn('flex size-3.5 items-center justify-center rounded-sm', LEVEL_STYLE[lvl])}>
                  <Icon className="size-2.5" strokeWidth={3} />
                </span>
                {label}
              </span>
            )
          })}
          <span className="flex items-center gap-1">
            <span className="size-3.5 rounded-sm border border-border" />
            Not checked
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3.5 rounded-sm ring-2 ring-foreground ring-offset-1 ring-offset-card" />
            Changed since the check before
          </span>
        </div>
        <FindingsGrid list={list} rows={rows} onlyChanged={onlyChanged} />
      </div>
    </div>
  )
}
