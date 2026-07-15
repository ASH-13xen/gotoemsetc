import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStepLibrary, useCreateStep } from '@/hooks/useStepLibrary'
import { useUpdateScopeOfWork } from '@/hooks/useQuotationTemplates'
import type { PlanType, QuotationTemplate, ScopeOfWorkSection } from '@/api/quotationTemplates.api'

const ADD_NEW = '__add_new__'

const DELIVERABLE_LABEL: Record<PlanType, string> = {
  duration: 'Deliverables (per monthly cycle)',
  quantity: 'Deliverables (per single unit, e.g. per podcast — multiplied by the client’s selected quantity)',
  fixed: 'Deliverables (one-time, for this engagement)',
}

function SectionEditor({
  section,
  planType,
  onChange,
  onRemove,
}: {
  section: ScopeOfWorkSection
  planType: PlanType
  onChange: (next: ScopeOfWorkSection) => void
  onRemove: () => void
}) {
  const { data } = useStepLibrary()
  const createStep = useCreateStep()
  const [newStepDraft, setNewStepDraft] = useState('')
  const library = data?.steps ?? []

  const addItem = () => onChange({ ...section, items: [...section.items, { label: '', qtyPerCycle: 1, perDay: false }] })
  const updateItem = (i: number, patch: Partial<ScopeOfWorkSection['items'][number]>) => {
    const items = section.items.map((item, idx) => (idx === i ? { ...item, ...patch } : item))
    onChange({ ...section, items })
  }
  const removeItem = (i: number) => onChange({ ...section, items: section.items.filter((_, idx) => idx !== i) })

  const addStep = (label: string) => {
    if (!label || section.steps.some((s) => s.label === label)) return
    const steps = [...section.steps, { label, order: section.steps.length + 1 }]
    onChange({ ...section, steps })
  }
  const removeStep = (i: number) => {
    const steps = section.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 }))
    onChange({ ...section, steps })
  }
  const moveStep = (i: number, dir: -1 | 1) => {
    const target = i + dir
    if (target < 0 || target >= section.steps.length) return
    const steps = [...section.steps]
    ;[steps[i], steps[target]] = [steps[target], steps[i]]
    onChange({ ...section, steps: steps.map((s, idx) => ({ ...s, order: idx + 1 })) })
  }

  const onSelectStep = (value: string) => {
    if (value === ADD_NEW) return
    addStep(value)
  }

  const onCreateAndAddStep = () => {
    const label = newStepDraft.trim()
    if (!label) return
    createStep.mutate(label, {
      onSuccess: () => {
        addStep(label)
        setNewStepDraft('')
      },
      onError: () => toast.error('Could not add step to the library'),
    })
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Input
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
          placeholder="Section name, e.g. Social Media Marketing"
          className="text-base font-semibold"
        />
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{DELIVERABLE_LABEL[planType]}</Label>
        {section.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item.label}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              placeholder="e.g. Number of Reels"
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              value={item.qtyPerCycle}
              onChange={(e) => updateItem(i, { qtyPerCycle: Number(e.target.value) })}
              className="w-24"
            />
            {planType === 'duration' && (
              <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={item.perDay ?? false}
                  onChange={(e) => updateItem(i, { perDay: e.target.checked })}
                />
                per day
              </label>
            )}
            <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-fit" onClick={addItem}>
          <Plus className="size-3.5" />
          Add deliverable
        </Button>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Step pipeline (every deliverable in this section follows these, in order)
        </Label>
        {section.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
            <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
            <span className="flex-1 text-sm font-medium">{step.label}</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => moveStep(i, -1)} disabled={i === 0}>
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => moveStep(i, 1)}
              disabled={i === section.steps.length - 1}
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => removeStep(i)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Select onValueChange={onSelectStep}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Add a step from the library…" />
            </SelectTrigger>
            <SelectContent>
              {library
                .filter((s) => !section.steps.some((existing) => existing.label === s.label))
                .map((s) => (
                  <SelectItem key={s._id} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="…or type a new step"
            value={newStepDraft}
            onChange={(e) => setNewStepDraft(e.target.value)}
            className="w-56"
          />
          <Button variant="outline" size="sm" onClick={onCreateAndAddStep} disabled={!newStepDraft.trim() || createStep.isPending}>
            {createStep.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ScopeOfWorkEditor({ template }: { template: QuotationTemplate }) {
  const [sections, setSections] = useState<ScopeOfWorkSection[]>(template.scopeOfWork ?? [])
  const updateScopeOfWork = useUpdateScopeOfWork(template._id)

  useEffect(() => {
    setSections(template.scopeOfWork ?? [])
  }, [template._id, template.scopeOfWork])

  const addSection = () => setSections((prev) => [...prev, { name: '', items: [], steps: [] }])
  const updateSection = (i: number, next: ScopeOfWorkSection) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? next : s)))
  const removeSection = (i: number) => setSections((prev) => prev.filter((_, idx) => idx !== i))

  const onSave = () => {
    if (sections.some((s) => !s.name.trim())) {
      toast.error('Every section needs a name')
      return
    }
    updateScopeOfWork.mutate(sections, {
      onSuccess: () => toast.success('Scope of Work saved — every client on this plan will use it from their next cycle'),
      onError: () => toast.error('Could not save Scope of Work'),
    })
  }

  const description =
    template.planType === 'duration'
      ? 'Define once here — every client on this plan gets these deliverables and steps recurring each monthly cycle, anchored to their onboarding date.'
      : template.planType === 'quantity'
        ? 'Define once here, per single unit (e.g. per podcast) — a client’s selected quantity (e.g. "4 podcasts") multiplies these into a one-time batch of tasks when their quotation is signed.'
        : 'Define once here — a signed quotation on this plan generates this one-time batch of tasks, exactly as listed (no recurrence, no quantity multiplier).'

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      {sections.map((section, i) => (
        <SectionEditor
          key={i}
          section={section}
          planType={template.planType}
          onChange={(next) => updateSection(i, next)}
          onRemove={() => removeSection(i)}
        />
      ))}
      <Button variant="outline" onClick={addSection} className="w-fit">
        <Plus className="size-4" />
        Add section
      </Button>
      <Button
        className="w-fit bg-primary text-primary-foreground hover:opacity-95"
        onClick={onSave}
        disabled={updateScopeOfWork.isPending}
      >
        {updateScopeOfWork.isPending && <Loader2 className="size-4 animate-spin" />}
        Save Scope of Work
      </Button>
    </div>
  )
}
