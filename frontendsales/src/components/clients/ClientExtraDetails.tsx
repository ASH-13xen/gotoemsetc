import { useState } from 'react'
import { toast } from 'sonner'
import { ListPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useUpdateClientExtraDetails } from '@/hooks/useClients'
import type { ExtraDetail } from '@/api/clients.api'

// Freeform key/value pairs, mirroring the EMS Employee profile's Extra
// Details section — lets admin record anything about a client that doesn't
// have its own field.
export function ClientExtraDetails({ clientId, extraDetails }: { clientId: string; extraDetails: ExtraDetail[] }) {
  const [keyDraft, setKeyDraft] = useState('')
  const [valueDraft, setValueDraft] = useState('')
  const update = useUpdateClientExtraDetails(clientId)

  const onAdd = () => {
    const key = keyDraft.trim()
    if (!key) return
    const next = [...extraDetails, { key, value: valueDraft.trim() }]
    update.mutate(next, {
      onSuccess: () => {
        setKeyDraft('')
        setValueDraft('')
      },
      onError: () => toast.error('Could not save extra detail'),
    })
  }

  const onRemove = (index: number) => {
    const next = extraDetails.filter((_, i) => i !== index)
    update.mutate(next, { onError: () => toast.error('Could not remove extra detail') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListPlus className="size-4" />
          Extra details
        </CardTitle>
        <p className="text-xs text-muted-foreground">Anything about this client that doesn't have its own field.</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Key" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className="flex-1 min-w-32" />
          <Input placeholder="Value" value={valueDraft} onChange={(e) => setValueDraft(e.target.value)} className="flex-1 min-w-32" />
          <Button size="sm" onClick={onAdd} disabled={!keyDraft.trim() || update.isPending} className="w-fit">
            Add
          </Button>
        </div>

        {extraDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No extra details yet.</p>
        ) : (
          <div className="grid gap-2">
            {extraDetails.map((detail, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{detail.key}</p>
                  <p className="text-sm break-words">{detail.value || '—'}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(i)} disabled={update.isPending}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
