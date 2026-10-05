import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, PlayCircle, RotateCcw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBulkSalarySlipPreview } from '@/hooks/useSalarySlips'
import { MANUAL_AMOUNT_FIELDS, type BulkCandidate, type ManualAmountKey, type ManualAmounts } from '@/api/salarySlips.api'
import { cn } from '@/lib/utils'

// The step before a bulk run: everyone who'll get a slip for the month, with
// the typed-in amounts (Other Earning, Other Deduction 3, …) editable per
// person. Nothing is generated until "Generate" is pressed.

type Draft = Record<string, Partial<Record<ManualAmountKey, string>>>

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const EARNINGS = MANUAL_AMOUNT_FIELDS.filter((f) => f.group === 'earning')
const DEDUCTIONS = MANUAL_AMOUNT_FIELDS.filter((f) => f.group === 'deduction')

function totals(draft: Draft[string] | undefined) {
  let added = 0
  let deducted = 0
  for (const field of MANUAL_AMOUNT_FIELDS) {
    const value = Number(draft?.[field.key]) || 0
    if (field.group === 'earning') added += value
    else deducted += value
  }
  return { added, deducted }
}

function Editor({
  candidates,
  busy,
  onCancel,
  onGenerate,
}: {
  candidates: BulkCandidate[]
  busy: boolean
  onCancel: () => void
  onGenerate: (adjustments: Record<string, ManualAmounts>) => void
}) {
  // Starts from what was typed in on each person's existing slip for the
  // month, so regenerating doesn't drop it.
  const [draft, setDraft] = useState<Draft>(() => {
    const initial: Draft = {}
    for (const c of candidates) {
      const entries = Object.entries(c.previous ?? {})
      if (c.skipped || entries.length === 0) continue
      initial[c._id] = Object.fromEntries(entries.map(([k, v]) => [k, String(v)]))
    }
    return initial
  })
  const payable = useMemo(() => candidates.filter((c) => !c.skipped), [candidates])
  const [selectedId, setSelectedId] = useState<string | null>(payable[0]?._id ?? null)
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((c) => c.name.toLowerCase().includes(q) || c.employeeCode.toLowerCase().includes(q))
  }, [candidates, search])
  const selected = candidates.find((c) => c._id === selectedId) ?? null
  const editedIds = payable.filter((c) => {
    const t = totals(draft[c._id])
    return t.added > 0 || t.deducted > 0
  })

  const setAmount = (id: string, key: ManualAmountKey, value: string) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }))
  const clear = (id: string) =>
    setDraft((d) => {
      const next = { ...d }
      delete next[id]
      return next
    })

  const submit = () => {
    const adjustments: Record<string, ManualAmounts> = {}
    for (const c of payable) {
      const amounts: ManualAmounts = {}
      for (const field of MANUAL_AMOUNT_FIELDS) {
        const value = Number(draft[c._id]?.[field.key])
        if (value > 0) amounts[field.key] = value
      }
      if (Object.keys(amounts).length > 0) adjustments[c._id] = amounts
    }
    onGenerate(adjustments)
  }

  const fieldGroup = (title: string, fields: typeof MANUAL_AMOUNT_FIELDS[number][], tone: string) => (
    <div>
      <p className={cn('mb-2 text-[11px] font-bold tracking-wider uppercase', tone)}>{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="grid gap-1">
            <Label htmlFor={`bulk-${field.key}`} className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                id={`bulk-${field.key}`}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                className="pl-7"
                disabled={busy}
                value={(selected && draft[selected._id]?.[field.key]) ?? ''}
                onChange={(e) => selected && setAmount(selected._id, field.key, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const selectedTotals = totals(selected ? draft[selected._id] : undefined)

  return (
    <>
      <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_1fr]">
        {/* who gets a slip */}
        <div className="flex min-h-0 flex-col border-b border-border md:border-r md:border-b-0">
          <div className="relative p-3">
            <Search className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an employee" className="h-9 pl-8 text-sm" />
          </div>
          <div className="max-h-48 min-h-0 flex-1 overflow-y-auto px-2 pb-2 md:max-h-none">
            {visible.map((c) => {
              const t = totals(draft[c._id])
              const edited = t.added > 0 || t.deducted > 0
              return (
                <button
                  key={c._id}
                  type="button"
                  disabled={c.skipped}
                  onClick={() => setSelectedId(c._id)}
                  className={cn(
                    'mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                    c._id === selectedId ? 'bg-primary/10' : 'hover:bg-secondary',
                    c.skipped && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                  )}
                >
                  <span
                    className={cn(
                      'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border',
                      edited ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {edited && <Check className="size-2.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground capitalize">{c.name.toLowerCase()}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.skipped
                        ? 'Your own slip — skipped'
                        : edited
                          ? [t.added > 0 && `+${rupees(t.added)}`, t.deducted > 0 && `−${rupees(t.deducted)}`].filter(Boolean).join('  ')
                          : c.notes[0] || c.employeeCode || 'No changes'}
                    </span>
                  </span>
                </button>
              )
            })}
            {visible.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nobody matches.</p>}
          </div>
        </div>

        {/* that person's amounts */}
        <div className="min-h-0 overflow-y-auto p-5">
          {selected ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground capitalize">{selected.name.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selected.employeeCode, selected.designation, selected.monthlyPay ? `${rupees(Math.round(selected.monthlyPay))} a month` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {(selectedTotals.added > 0 || selectedTotals.deducted > 0) && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => clear(selected._id)}>
                    <RotateCcw className="size-3.5" /> Clear
                  </Button>
                )}
              </div>
              {selected.notes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.notes.map((note) => (
                    <span key={note} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      {note}
                    </span>
                  ))}
                </div>
              )}
              {selected.hasSlip && (
                <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  A slip for this month already exists
                  {Object.keys(selected.previous ?? {}).length > 0 ? ' — the amounts typed in on it are filled in below.' : '.'} The new slip
                  replaces it as the latest; the old one is kept.
                </p>
              )}
              {fieldGroup('Add to pay', EARNINGS, 'text-emerald-700')}
              {fieldGroup('Deduct from pay', DEDUCTIONS, 'text-destructive')}
              <p className="text-xs text-muted-foreground">
                Attendance pay, overtime, late and short-leave deductions and the month's paid off are worked out automatically.
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Pick an employee to add or change an amount.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/40 px-5 py-3.5">
        <p className="text-xs text-muted-foreground">
          {busy ? (
            'Generating slips and the master sheet — this can take a minute or two. Keep this window open.'
          ) : (
            <>
              <span className="font-semibold text-foreground">{payable.length}</span> slip{payable.length === 1 ? '' : 's'} will be generated ·{' '}
              <span className="font-semibold text-foreground">{editedIds.length}</span> with amounts entered
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || payable.length === 0}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Generate & download zip
          </Button>
        </div>
      </div>
    </>
  )
}

export function BulkSlipAdjustDialog({
  open,
  onOpenChange,
  month,
  year,
  periodLabel,
  busy,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: number
  year: number
  periodLabel: string
  busy: boolean
  onGenerate: (adjustments: Record<string, ManualAmounts>) => void
}) {
  const preview = useBulkSalarySlipPreview({ month, year }, open)
  const errorMessage =
    (preview.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Could not load the employees for this month'

  return (
    // Can't be dismissed mid-run — the zip download follows the generation.
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0" showCloseButton={!busy}>
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Salary slips for {periodLabel}</DialogTitle>
          <DialogDescription>
            Anything to add or change for anyone before generating? Pick an employee and enter it — everyone else is generated as calculated.
          </DialogDescription>
        </DialogHeader>
        {preview.isPending ? (
          <div className="grid flex-1 gap-3 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : preview.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertTriangle className="size-6 text-amber-600" />
            <p className="text-sm text-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {preview.data.pendingOvertime > 0 && (
              <p className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="size-4 shrink-0" />
                {preview.data.pendingOvertime} overtime request{preview.data.pendingOvertime === 1 ? ' is' : 's are'} still waiting for approval for
                this month. Overtime that isn't approved is not paid on these slips.
              </p>
            )}
          <Editor
            key={`${year}-${month}`}
            candidates={preview.data.employees}
            busy={busy}
            onCancel={() => onOpenChange(false)}
            onGenerate={onGenerate}
          />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
