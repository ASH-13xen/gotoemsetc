import { useEffect, useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateClient } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import type { Client, ClientContact } from '@/api/cms.api'

const EMPTY: ClientContact = { name: '', role: '', email: '', phone: '', isPrimary: false }

export function ClientContactsCard({ client }: { client: Client }) {
  const { canEditClient } = useCmsAccess()
  const update = useUpdateClient(client._id)
  const [contacts, setContacts] = useState<ClientContact[]>(client.contacts ?? [])

  useEffect(() => setContacts(client.contacts ?? []), [client])

  const patch = (i: number, key: keyof ClientContact, value: string | boolean) =>
    setContacts((list) => list.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)))

  // Primary is exclusive — the server normalises this too, but doing it here
  // keeps the radio-like behaviour obvious while editing.
  const setPrimary = (i: number) =>
    setContacts((list) => list.map((c, idx) => ({ ...c, isPrimary: idx === i })))

  function save() {
    update.mutate({ contacts: contacts.filter((c) => c.name.trim()) })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pt-6">
        <CardTitle>Contact information</CardTitle>
        {canEditClient && (
          <Button variant="secondary" size="sm" onClick={() => setContacts((l) => [...l, { ...EMPTY }])}>
            <Plus className="mr-2 size-4" />
            Add contact
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {contacts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No contacts recorded yet.</p>
        ) : (
          contacts.map((contact, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!canEditClient}
                  onClick={() => setPrimary(i)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none"
                  title="Mark as the main point of contact"
                >
                  <Star
                    className={`size-3.5 ${contact.isPrimary ? 'fill-amber-500 text-amber-500' : ''}`}
                  />
                  {contact.isPrimary ? 'Primary contact' : 'Set as primary'}
                </button>
                {canEditClient && (
                  <button
                    type="button"
                    onClick={() => setContacts((l) => l.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove contact"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`c-name-${i}`}>Name</Label>
                  <Input
                    id={`c-name-${i}`}
                    value={contact.name}
                    disabled={!canEditClient}
                    onChange={(e) => patch(i, 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`c-role-${i}`}>Role</Label>
                  <Input
                    id={`c-role-${i}`}
                    value={contact.role ?? ''}
                    disabled={!canEditClient}
                    onChange={(e) => patch(i, 'role', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`c-email-${i}`}>Email</Label>
                  <Input
                    id={`c-email-${i}`}
                    type="email"
                    value={contact.email ?? ''}
                    disabled={!canEditClient}
                    onChange={(e) => patch(i, 'email', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`c-phone-${i}`}>Phone</Label>
                  <Input
                    id={`c-phone-${i}`}
                    value={contact.phone ?? ''}
                    disabled={!canEditClient}
                    onChange={(e) => patch(i, 'phone', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))
        )}

        {canEditClient && contacts.length > 0 && (
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save contacts'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
