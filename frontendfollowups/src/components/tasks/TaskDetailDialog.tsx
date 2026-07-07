import { useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Paperclip, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import {
  useAddComment,
  useRemoveAttachment,
  useUpdateTaskStatus,
  useUploadAttachment,
} from '@/hooks/useTasks'
import type { Task, TaskStatus } from '@/api/tasks.api'

interface TaskDetailDialogProps {
  task: Task | null
  onClose: () => void
}

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done']

export function TaskDetailDialog({ task, onClose }: TaskDetailDialogProps) {
  const [comment, setComment] = useState('')
  const updateStatus = useUpdateTaskStatus()
  const addComment = useAddComment()
  const uploadAttachment = useUploadAttachment()
  const removeAttachment = useRemoveAttachment()

  if (!task) return null

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !task) return
    uploadAttachment.mutate(
      { id: task._id, file },
      {
        onSuccess: () => toast.success('File attached'),
        onError: () => toast.error('Could not upload file'),
      }
    )
    e.target.value = ''
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <TaskPriorityBadge priority={task.priority} />
          <TaskStatusBadge status={task.status} />
          <Select
            value={task.status}
            onValueChange={(v) => updateStatus.mutate({ id: task._id, status: v as TaskStatus })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {task.assigneeEmployees.map((a) => (
            <span key={a._id}>
              {a.firstName} {a.lastName}
            </span>
          ))}
          {task.assigneeTeam && <span>Team: {task.assigneeTeam.name}</span>}
          {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-black tracking-widest uppercase">Attachments</h4>
          {task.attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attachments.</p>
          ) : (
            task.attachments.map((att) => (
              <div key={att._id} className="flex items-center justify-between border-2 border-foreground p-2">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <Paperclip className="size-4" />
                  {att.originalFilename ?? 'Attachment'}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAttachment.mutate({ id: task._id, attachmentId: att._id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wide underline">
            {uploadAttachment.isPending && <Loader2 className="size-3 animate-spin" />}
            Attach a file
            <input type="file" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-black tracking-widest uppercase">Comments</h4>
          {task.comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            task.comments.map((c) => (
              <div key={c._id} className="border-2 border-foreground p-2 text-sm">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{c.author?.username ?? 'Unknown'}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                {c.body}
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="min-h-16"
            />
            <Button
              onClick={() => {
                if (!comment.trim()) return
                addComment.mutate(
                  { id: task._id, body: comment },
                  { onSuccess: () => setComment('') }
                )
              }}
              disabled={addComment.isPending}
            >
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
