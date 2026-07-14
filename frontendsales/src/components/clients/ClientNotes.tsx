import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, NotebookPen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAddClientNote, useClientNotes, useDeleteClientNote } from '@/hooks/useClientNotes'

export function ClientNotes({ clientId }: { clientId: string }) {
  const [draft, setDraft] = useState('')
  const { data, isLoading } = useClientNotes(clientId)
  const addNote = useAddClientNote(clientId)
  const deleteNote = useDeleteClientNote(clientId)
  const notes = data?.notes ?? []

  const onAdd = () => {
    if (!draft.trim()) return
    addNote.mutate(draft.trim(), {
      onSuccess: () => setDraft(''),
      onError: () => toast.error('Could not add note'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <NotebookPen className="size-4" />
          Internal notes
        </CardTitle>
        <p className="text-xs text-muted-foreground">Visible only to staff — never shared with the client.</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Textarea
            placeholder="Add an internal note…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button size="sm" onClick={onAdd} disabled={!draft.trim() || addNote.isPending} className="w-fit">
            {addNote.isPending && <Loader2 className="size-4 animate-spin" />}
            Add note
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="grid gap-2">
            {notes.map((note) => (
              <div key={note._id} className="flex items-start justify-between gap-3 rounded-xl bg-secondary/30 p-3">
                <div>
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.createdBy?.username ?? 'Unknown'} · {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    deleteNote.mutate(note._id, {
                      onSuccess: () => toast.success('Note removed'),
                      onError: () => toast.error('Could not remove note'),
                    })
                  }
                >
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
