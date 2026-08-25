import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSubmitMom } from '@/hooks/useMeetings'
import type { EmployeeRef } from '@/api/cms.api'
import type { Meeting } from '@/api/meetings.api'

function StringListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    onChange([...items, draft.trim()])
    setDraft('')
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-sm">
          <span className="flex-1">{item}</span>
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="size-4" /></Button>
      </div>
    </div>
  )
}

// Structured, not a blob — summary, present/absent, decisions, action
// items — so the generated manual doesn't just read as a wall of text.
export function MomForm({ clientId, meeting }: { clientId: string; meeting: Meeting }) {
  const submit = useSubmitMom(clientId, meeting._id)

  const [summary, setSummary] = useState('')
  const [present, setPresent] = useState<string[]>(meeting.participants.map((p) => p._id))
  const [decisions, setDecisions] = useState<string[]>([])
  const [actionItems, setActionItems] = useState<string[]>([])

  const togglePresent = (id: string) => {
    setPresent((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function save() {
    submit.mutate({
      summary,
      attendeesPresent: present,
      attendeesAbsent: meeting.participants.filter((p) => !present.includes(p._id)).map((p) => p._id),
      decisions,
      actionItems,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Summary</Label>
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Present</Label>
        <div className="flex flex-wrap gap-2">
          {meeting.participants.map((e: EmployeeRef) => {
            const active = present.includes(e._id)
            return (
              <button
                key={e._id}
                type="button"
                onClick={() => togglePresent(e._id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
              >
                {e.firstName} {e.lastName ?? ''}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">Unselected participants are recorded as absent.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Decisions</Label>
        <StringListEditor items={decisions} onChange={setDecisions} placeholder="Add a decision…" />
      </div>
      <div className="space-y-1.5">
        <Label>Action items</Label>
        <StringListEditor items={actionItems} onChange={setActionItems} placeholder="Add an action item…" />
      </div>

      <Button onClick={save} disabled={submit.isPending}>
        {submit.isPending ? 'Saving…' : 'Save MOM'}
      </Button>
    </div>
  )
}
