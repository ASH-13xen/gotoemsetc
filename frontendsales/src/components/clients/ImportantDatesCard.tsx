import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClientEvents, useCreateClientEvent, useDeleteClientEvent } from '@/hooks/useCompanyEvents'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { COMPANY_EVENT_TYPE_LABEL, type CompanyEventType } from '@/api/companyEvents.api'

const TYPES: CompanyEventType[] = ['client_birthday', 'client_anniversary', 'brand_anniversary', 'important']

// Birthdays, anniversaries, brand anniversary — one flexible dated-event
// list rather than fixed fields, so new kinds (a spouse's birthday, a
// founding day) never need a schema change. Reminders fire automatically
// (see backend/src/jobs/birthdayReminder.job.js), scoped to this client's
// team instead of the whole company.
export function ImportantDatesCard({ clientId }: { clientId: string }) {
  const { canEditClient } = useCmsAccess()
  const { data: events, isLoading } = useClientEvents(clientId)
  const create = useCreateClientEvent(clientId)
  const remove = useDeleteClientEvent(clientId)

  const [type, setType] = useState<CompanyEventType>('client_birthday')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  const add = () => {
    if (!name.trim() || !date) return
    create.mutate(
      { type, name: name.trim(), date, notes: notes.trim() || undefined },
      { onSuccess: () => { setName(''); setDate(''); setNotes('') } }
    )
  }

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Important dates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">None on file yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e._id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2 text-sm">
                <div>
                  <Badge variant="outline" className="mr-2 font-normal">{COMPANY_EVENT_TYPE_LABEL[e.type]}</Badge>
                  <span className="font-medium">{e.name}</span>{' '}
                  <span className="text-muted-foreground">
                    — {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                  </span>
                  {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
                </div>
                {canEditClient && (
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(e._id)} disabled={remove.isPending}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEditClient && (
          <div className="space-y-3 border-t border-border/40 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as CompanyEventType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t} value={t}>{COMPANY_EVENT_TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Founder's birthday" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button size="sm" onClick={add} disabled={create.isPending || !name.trim() || !date}>
              <Plus className="mr-1.5 size-4" />
              Add date
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
