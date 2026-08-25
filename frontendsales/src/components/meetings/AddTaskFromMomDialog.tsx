import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { useAddTaskFromMom } from '@/hooks/useMeetings'
import type { Client, EmployeeRef } from '@/api/cms.api'
import type { AddTaskInput, MomPipelineKind, MomTaskKind } from '@/api/meetings.api'

const PIPELINE_COLORS = ['#f97316', '#22c55e', '#14b8a6', '#84cc16', '#a855f7', '#e6d9b8', '#eab308', '#06b6d4', '#3b82f6', '#ffb385']

// The MOM's "any more tasks required?" step — every permutation: Personal
// (any employee), Team (client's team + outside extras), or Pipeline
// (an existing Post/Reel-style flow, or a fully custom 2-5 step one) —
// each with its own colour and a single assignee. Pipeline tasks are
// deliberately off-calendar: no date picked against a quota, no calendar
// grid presence, just the same colours/steps/actor logic tracked directly
// on the task.
export function AddTaskFromMomDialog({
  open,
  onOpenChange,
  client,
  meetingId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  meetingId: string
}) {
  const addTask = useAddTaskFromMom(client._id, meetingId)
  const { data: allEmployees } = useOpenEmployeeDirectory()

  const [kind, setKind] = useState<MomTaskKind>('personal')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const [assigneeId, setAssigneeId] = useState('')
  const [extraMembers, setExtraMembers] = useState<string[]>([])

  const [pipelineKind, setPipelineKind] = useState<MomPipelineKind>('post')
  const [designer, setDesigner] = useState('')
  const [shooter, setShooter] = useState('')
  const [editor, setEditor] = useState('')
  const [contentManager, setContentManager] = useState('')
  const [customSteps, setCustomSteps] = useState<Array<{ label: string; color: string; assignee: string }>>([
    { label: '', color: PIPELINE_COLORS[0], assignee: '' },
    { label: '', color: PIPELINE_COLORS[1], assignee: '' },
  ])

  const roster: EmployeeRef[] = [
    ...(client.defaultTeam?.leader ? [client.defaultTeam.leader] : []),
    ...(client.defaultTeam?.members ?? []),
  ]
  const everyone = allEmployees ?? roster

  const reset = () => {
    setTitle(''); setDescription(''); setStartAt(''); setEndAt('')
    setAssigneeId(''); setExtraMembers([])
    setDesigner(''); setShooter(''); setEditor(''); setContentManager('')
    setCustomSteps([{ label: '', color: PIPELINE_COLORS[0], assignee: '' }, { label: '', color: PIPELINE_COLORS[1], assignee: '' }])
  }

  const addCustomStep = () => {
    if (customSteps.length >= 5) return
    setCustomSteps((s) => [...s, { label: '', color: PIPELINE_COLORS[s.length % PIPELINE_COLORS.length], assignee: '' }])
  }
  const removeCustomStep = (i: number) => {
    if (customSteps.length <= 2) return
    setCustomSteps((s) => s.filter((_, idx) => idx !== i))
  }

  const ready =
    Boolean(title.trim() && startAt && endAt) &&
    (kind === 'personal'
      ? Boolean(assigneeId)
      : kind === 'team'
        ? true
        : pipelineKind === 'custom'
          ? customSteps.every((s) => s.label.trim() && s.assignee)
          : pipelineKind === 'post'
            ? Boolean(designer)
            : Boolean(shooter && editor && contentManager))

  function submit() {
    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
    }
    let input: AddTaskInput
    if (kind === 'personal') {
      input = { ...base, kind, assigneeId }
    } else if (kind === 'team') {
      input = { ...base, kind, extraMembers }
    } else {
      input = {
        ...base,
        kind,
        pipeline:
          pipelineKind === 'custom'
            ? { kind: pipelineKind, customSteps }
            : pipelineKind === 'post'
              ? { kind: pipelineKind, assignments: { designer } }
              : { kind: pipelineKind, assignments: { shooter, editor, contentManager } },
      }
    }
    addTask.mutate(input, { onSuccess: () => { reset(); onOpenChange(false) } })
  }

  const person = (value: string, onChange: (v: string) => void, label: string, pool: EmployeeRef[] = roster) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Pick someone" /></SelectTrigger>
        <SelectContent>
          {pool.map((e) => (
            <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName ?? ''}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a task from this MOM</DialogTitle>
          <DialogDescription>Shows up in Task Management, linked back to this meeting's MOM.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MomTaskKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="pipeline">Pipeline (Post/Reel/Custom)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>

          {kind === 'personal' && person(assigneeId, setAssigneeId, 'Assignee (team or outside)', everyone)}

          {kind === 'team' && (
            <div className="space-y-1.5">
              <Label>Extra members outside the team (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {everyone
                  .filter((e) => !roster.some((r) => r._id === e._id))
                  .map((e) => {
                    const active = extraMembers.includes(e._id)
                    return (
                      <button
                        key={e._id}
                        type="button"
                        onClick={() => setExtraMembers((m) => (active ? m.filter((x) => x !== e._id) : [...m, e._id]))}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
                      >
                        {e.firstName} {e.lastName ?? ''}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}

          {kind === 'pipeline' && (
            <div className="space-y-4 rounded-xl border border-border/40 p-4">
              <div className="space-y-1.5">
                <Label>Pipeline</Label>
                <Select value={pipelineKind} onValueChange={(v) => setPipelineKind(v as MomPipelineKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Existing — Post</SelectItem>
                    <SelectItem value="reel">Existing — Reel</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pipelineKind === 'post' && person(designer, setDesigner, 'Social Media Manager')}
              {pipelineKind === 'reel' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {person(shooter, setShooter, 'Videographer')}
                  {person(editor, setEditor, 'Editor')}
                  {person(contentManager, setContentManager, 'Content Manager')}
                </div>
              )}
              {pipelineKind === 'custom' && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">2–5 steps, each with its own colour and one assignee (team or outside).</p>
                  {customSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder={`Step ${i + 1} label`}
                        value={step.label}
                        onChange={(e) => setCustomSteps((s) => s.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                      />
                      <input
                        type="color"
                        value={step.color}
                        onChange={(e) => setCustomSteps((s) => s.map((x, idx) => (idx === i ? { ...x, color: e.target.value } : x)))}
                        className="size-9 shrink-0 rounded-md border border-border"
                      />
                      <Select
                        value={step.assignee}
                        onValueChange={(v) => setCustomSteps((s) => s.map((x, idx) => (idx === i ? { ...x, assignee: v } : x)))}
                      >
                        <SelectTrigger className="w-40 shrink-0"><SelectValue placeholder="Assignee" /></SelectTrigger>
                        <SelectContent>
                          {everyone.map((e) => (
                            <SelectItem key={e._id} value={e._id}>{e.firstName} {e.lastName ?? ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {customSteps.length > 2 && (
                        <Button variant="ghost" size="icon" onClick={() => removeCustomStep(i)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {customSteps.length < 5 && (
                    <Button variant="outline" size="sm" onClick={addCustomStep}>
                      <Plus className="mr-1.5 size-4" />
                      Add step
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!ready || addTask.isPending}>
            {addTask.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
