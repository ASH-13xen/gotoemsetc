import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePipelineLog, useCreatePipelineLogEntry } from '@/hooks/usePipelineLog'
import { PIPELINE_STAGES } from '@/api/tasks.api'
import type { TaskStage } from '@/api/tasks.api'
import type { PipelineLogEntry } from '@/api/pipelineLog.api'

function StageSection({
  clientId,
  title,
  stage,
  entries,
  customLabel,
}: {
  clientId: string
  title: string
  stage: TaskStage
  entries: PipelineLogEntry[]
  customLabel?: string
}) {
  const [note, setNote] = useState('')
  const createEntry = useCreatePipelineLogEntry(clientId)

  const onAdd = () => {
    if (!note.trim()) return
    createEntry.mutate(
      { stage, customLabel, note: note.trim() },
      {
        onSuccess: () => setNote(''),
        onError: () => toast.error('Could not add log entry'),
      }
    )
  }

  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Logged by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                  Nothing logged yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>
                    {new Date(entry.taskDate ?? entry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="whitespace-normal">{entry.note}</TableCell>
                  <TableCell>{entry.loggedByName ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Log what you did…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
        <Button size="icon" variant="outline" onClick={onAdd} disabled={createEntry.isPending}>
          {createEntry.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export function PipelineTable({ clientId }: { clientId: string }) {
  const { data, isLoading } = usePipelineLog(clientId)

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading pipeline…</p>

  return (
    <div className="grid gap-6">
      {PIPELINE_STAGES.map((s) => (
        <StageSection
          key={s.value}
          clientId={clientId}
          title={s.label}
          stage={s.value}
          entries={data.stages[s.value as Exclude<TaskStage, 'custom'>] ?? []}
        />
      ))}

      {data.others.length > 0 && (
        <div className="grid gap-4 border-t-2 border-foreground pt-4">
          <h3 className="text-xs font-black uppercase tracking-widest">Others</h3>
          {data.others.map((group) => (
            <StageSection
              key={group.label}
              clientId={clientId}
              title={group.label}
              stage="custom"
              customLabel={group.label}
              entries={group.entries}
            />
          ))}
        </div>
      )}
    </div>
  )
}
