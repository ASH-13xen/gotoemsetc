import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Paperclip, Send, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import {
  useAddComment,
  useRemoveAttachment,
  useUpdateTask,
  useUpdateTaskStatus,
  useUploadAttachment,
} from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { PIPELINE_STAGES } from '@/api/tasks.api'
import type { Task, TaskPriority, TaskStage, TaskStatus } from '@/api/tasks.api'

function canMessage(task: Task, userId: string | undefined, role: string | undefined, employeeLink: string | null | undefined) {
  if (role === 'admin') return true
  if (!employeeLink) return false
  return task.assigneeEmployees.some((e) => e._id === employeeLink)
}

export function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { user } = useAuth()
  const [commentBody, setCommentBody] = useState('')
  const [doneSummary, setDoneSummary] = useState('')
  const [pendingDone, setPendingDone] = useState(false)

  const updateTask = useUpdateTask(task?._id ?? '')
  const updateStatus = useUpdateTaskStatus()
  const addComment = useAddComment()
  const uploadAttachment = useUploadAttachment()
  const removeAttachment = useRemoveAttachment()

  useEffect(() => {
    setCommentBody('')
    setDoneSummary('')
    setPendingDone(false)
  }, [task?._id])

  if (!task) return null

  const allowMessage = canMessage(task, user?.id, user?.role, user?.employeeLink)

  const onStatusChange = (status: TaskStatus) => {
    if (status === 'done') {
      setPendingDone(true)
      return
    }
    updateStatus.mutate(
      { id: task._id, status },
      { onError: () => toast.error('Could not update status') }
    )
  }

  const onConfirmDone = () => {
    if (!doneSummary.trim()) {
      toast.error('A summary is required to mark this task done')
      return
    }
    updateStatus.mutate(
      { id: task._id, status: 'done', summary: doneSummary.trim() },
      {
        onSuccess: () => {
          toast.success('Task marked done')
          setPendingDone(false)
        },
        onError: () => toast.error('Could not update status'),
      }
    )
  }

  const onStageChange = (stage: TaskStage) => {
    updateTask.mutate({ stage }, { onError: () => toast.error('Could not update label') })
  }

  const onPriorityChange = (priority: TaskPriority) => {
    updateTask.mutate({ priority }, { onError: () => toast.error('Could not update priority') })
  }

  const onPostComment = () => {
    if (!commentBody.trim()) return
    addComment.mutate(
      { id: task._id, body: commentBody.trim() },
      {
        onSuccess: () => setCommentBody(''),
        onError: () => toast.error('Could not post — you may not have permission to message on this task'),
      }
    )
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadAttachment.mutate(
      { id: task._id, file },
      { onError: () => toast.error('Upload failed') }
    )
    e.target.value = ''
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Label</Label>
              <Select value={task.stage} onValueChange={(v) => onStageChange(v as TaskStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{task.customLabel || 'Custom'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={task.priority} onValueChange={(v) => onPriorityChange(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={task.status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {pendingDone && (
            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="done-summary" className="text-xs">
                Summary (required to mark this task done)
              </Label>
              <Textarea id="done-summary" value={doneSummary} onChange={(e) => setDoneSummary(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={onConfirmDone} disabled={updateStatus.isPending}>
                  {updateStatus.isPending && <Loader2 className="size-4 animate-spin" />}
                  Confirm Done
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingDone(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {task.summary && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Summary</p>
              <p>{task.summary}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <TaskPriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
            {task.dueDate && <span className="text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</span>}
          </div>

          <div className="text-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assignees</p>
            <div className="flex flex-wrap gap-2">
              {task.assigneeTeam && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{task.assigneeTeam.name} (team)</span>
              )}
              {task.assigneeEmployees.map((e) => (
                <span key={e._id} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                  {e.firstName} {e.lastName}
                </span>
              ))}
              {!task.assigneeTeam && task.assigneeEmployees.length === 0 && (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attachments</p>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-primary">
                <Paperclip className="size-3.5" />
                Upload
                <input type="file" className="hidden" onChange={onUpload} />
              </label>
            </div>
            {task.attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attachments.</p>
            ) : (
              <div className="grid gap-1">
                {task.attachments.map((a) => (
                  <div key={a._id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                      {a.originalFilename || a.url}
                    </a>
                    <button
                      onClick={() =>
                        removeAttachment.mutate({ id: task._id, attachmentId: a._id }, {
                          onError: () => toast.error('Could not remove attachment'),
                        })
                      }
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Messages</p>
            <div className="grid max-h-56 gap-2 overflow-y-auto">
              {task.comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages yet.</p>
              ) : (
                task.comments.map((c) => (
                  <div key={c._id} className="rounded-lg border border-border p-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{c.author.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p>{c.body}</p>
                  </div>
                ))
              )}
            </div>
            {allowMessage ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Write a message…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onPostComment()}
                />
                <Button size="icon" onClick={onPostComment} disabled={addComment.isPending}>
                  <Send className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only admins and this task's assignees can post messages.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
