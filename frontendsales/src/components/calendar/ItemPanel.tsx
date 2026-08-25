import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { useAdvanceItem, useDeleteItem, useSendBackItem, useUpdateBrief } from '@/hooks/useCms'
import type { CalendarItem, CalendarView, TaskRef } from '@/api/cms.api'
import { RejectDialog } from './RejectDialog'
import { PipelineStepper } from './PipelineStepper'
import { formatIstDateTime } from '@/lib/istDate'

function TaskLine({ label, task }: { label: string; task?: TaskRef }) {
  if (!task) return null
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={task.status === 'completed' ? 'secondary' : 'outline'} className="font-normal">
        {task.status.replace(/_/g, ' ')}
      </Badge>
    </div>
  )
}

export function ItemPanel({ item, view }: { item: CalendarItem; view: CalendarView }) {
  const access = useCmsAccess()
  const [open, setOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [brief, setBrief] = useState(item.brief ?? {})

  const calendarId = view.calendar._id
  const team = view.calendar.team
  const isClosed = Boolean(view.calendar.closedAt)

  const advance = useAdvanceItem(calendarId)
  const sendBack = useSendBackItem(calendarId)
  const remove = useDeleteItem(calendarId)
  const saveBrief = useUpdateBrief(calendarId)

  const currentStep = item.trail.find((s) => s.current)
  const isTerminal = Boolean(currentStep?.terminal)
  const canAct = access.canAct(item, team) && !isClosed && !isTerminal

  return (
    <div className="rounded-xl border border-border/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: item.color }}
        >
          {item.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.brief?.postingName || item._id}</span>
        {item.isSentBack && (
          <Badge className="shrink-0 font-normal" style={{ backgroundColor: '#f9a8d4', color: '#831843' }}>
            Sent back
          </Badge>
        )}
        {item.isRejected && (
          <Badge variant="destructive" className="shrink-0 font-normal">
            Rejected
          </Badge>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/40 p-4">
          <PipelineStepper trail={item.trail} isSentBack={item.isSentBack} isRejected={item.isRejected} />

          {item.isRejected && item.lastRejection?.reason && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <span className="font-medium">Rejected:</span> {item.lastRejection.reason}
            </div>
          )}

          {/* Assignments and the live status of the Task Management records
              this item drives — read from the tasks themselves, so completing
              work over there shows up here immediately. */}
          <div className="space-y-1.5 rounded-lg bg-secondary/50 p-3">
            {item.assignments?.designer && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Assignee</span>
                <span>
                  {item.assignments.designer.firstName} {item.assignments.designer.lastName ?? ''}
                </span>
              </div>
            )}
            {item.assignments?.shooter && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Videographer</span>
                <span>
                  {item.assignments.shooter.firstName} {item.assignments.shooter.lastName ?? ''}
                </span>
              </div>
            )}
            {item.assignments?.editor && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Editor</span>
                <span>
                  {item.assignments.editor.firstName} {item.assignments.editor.lastName ?? ''}
                </span>
              </div>
            )}
            {item.assignments?.contentManager && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Content Manager</span>
                <span>
                  {item.assignments.contentManager.firstName} {item.assignments.contentManager.lastName ?? ''}
                </span>
              </div>
            )}
            <TaskLine label="Task" task={item.task} />
            <TaskLine label="Design" task={item.subtaskRefs?.design} />
            <TaskLine label="Videographer" task={item.subtaskRefs?.shoot} />
            <TaskLine label="Editor" task={item.subtaskRefs?.edit} />
            <TaskLine label="Content Manager" task={item.subtaskRefs?.contentManager} />
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['postingName', 'Posting name'],
                  ['postingLink', 'Posting link'],
                  ['collabsAndTags', 'Collabs + tags'],
                  ['uploadDestination', 'Upload destination'],
                  ['deliverableLink', 'Deliverable link'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`${item._id}-${key}`} className="text-xs">
                    {label}
                  </Label>
                  <Input
                    id={`${item._id}-${key}`}
                    value={brief[key] ?? ''}
                    disabled={access.isReadOnly}
                    onChange={(e) => setBrief((b) => ({ ...b, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${item._id}-caption`} className="text-xs">
                Caption
              </Label>
              <Textarea
                id={`${item._id}-caption`}
                rows={2}
                value={brief.caption ?? ''}
                disabled={access.isReadOnly}
                onChange={(e) => setBrief((b) => ({ ...b, caption: e.target.value }))}
              />
            </div>
            {!access.isReadOnly && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => saveBrief.mutate({ id: item._id, brief })}
                disabled={saveBrief.isPending}
              >
                Save details
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
            {canAct && (
              <Button size="sm" onClick={() => advance.mutate({ id: item._id })} disabled={advance.isPending}>
                Mark done
              </Button>
            )}
            {canAct && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendBack.mutate({ id: item._id })}
                disabled={sendBack.isPending}
                style={{ borderColor: '#f9a8d4', color: '#be185d' }}
              >
                <Undo2 className="mr-1.5 size-3.5" />
                Send back
              </Button>
            )}
            {canAct && (
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
            )}
            {access.canManageCalendar && !isClosed && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive"
                onClick={() => remove.mutate(item._id)}
                disabled={remove.isPending}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Remove
              </Button>
            )}
          </div>

          {item.stageHistory && item.stageHistory.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">History</summary>
              <ul className="mt-2 space-y-1.5">
                {item.stageHistory.map((entry, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{entry.action}</span>
                    {' → '}
                    {entry.to.replace(/_/g, ' ')}
                    {entry.onBehalfOf && ` (on behalf of the ${entry.onBehalfOf})`}
                    {' · '}
                    {formatIstDateTime(entry.at)}
                    {entry.note && <div className="italic">“{entry.note}”</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} item={item} calendarId={calendarId} />
    </div>
  )
}
