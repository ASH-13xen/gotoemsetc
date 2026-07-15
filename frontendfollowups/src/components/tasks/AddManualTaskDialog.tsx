import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateManualTasks } from '@/hooks/useTasks'

// Admin-only — lets admin add a deliverable (or a whole new section, like a
// "YouTube Shorts" line) on top of whatever the quotation template
// auto-generated, into the client's current cycle.
export function AddManualTaskDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [steps, setSteps] = useState<string[]>([])
  const [stepDraft, setStepDraft] = useState('')
  const create = useCreateManualTasks(clientId)

  const reset = () => {
    setSectionName('')
    setItemLabel('')
    setDescription('')
    setQuantity('1')
    setSteps([])
    setStepDraft('')
  }

  const addStep = () => {
    const label = stepDraft.trim()
    if (!label) return
    setSteps((prev) => [...prev, label])
    setStepDraft('')
  }

  const onSubmit = () => {
    if (!sectionName.trim() || !itemLabel.trim()) {
      toast.error('Section and deliverable name are required')
      return
    }
    const qty = Number(quantity)
    create.mutate(
      {
        sectionName: sectionName.trim(),
        itemLabel: itemLabel.trim(),
        description: description.trim() || undefined,
        steps: steps.map((label) => ({ label })),
        quantity: Number.isInteger(qty) && qty > 0 ? qty : 1,
      },
      {
        onSuccess: (result) => {
          toast.success(`Added ${result.tasks.length} task(s)`)
          reset()
          setOpen(false)
        },
        onError: () => toast.error('Could not add task — make sure this client has a synced cycle'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" />
          Add task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a task</DialogTitle>
          <DialogDescription>
            Adds a deliverable on top of what the quotation auto-generated — use a new section name (e.g. "YouTube
            Shorts") to create a whole new section.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Section</Label>
              <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="e.g. YouTube Shorts" />
            </div>
            <div className="grid gap-1.5">
              <Label>Deliverable name</Label>
              <Input value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder="e.g. Short" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-1.5">
            <Label>How many (creates "#1", "#2"… if more than one)</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24" />
          </div>

          <div className="grid gap-1.5">
            <Label>Steps</Label>
            {steps.length > 0 && (
              <div className="grid gap-1.5">
                {steps.map((label, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-sm">
                    <span>
                      {i + 1}. {label}
                    </span>
                    <button onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Plan of Action"
                value={stepDraft}
                onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addStep()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addStep}>
                Add step
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
