import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTaskChat } from '@/hooks/useTaskChat'
import { usePostMessage } from '@/hooks/useTasks'

export function TaskChatPanel({ taskId }: { taskId: string }) {
  const { messages, isLoading } = useTaskChat(taskId)
  const postMessage = usePostMessage(taskId)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const onSend = () => {
    const body = draft.trim()
    if (!body) return
    postMessage.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: () => toast.error('Could not send message'),
    })
  }

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Status updates &amp; chat
      </p>
      <div className="mb-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet — post an update below.</p>
        ) : (
          messages.map((m) => (
            <div key={m._id} className="text-sm">
              <span className="font-semibold">
                {m.sender ? `${m.sender.firstName} ${m.sender.lastName ?? ''}` : 'Admin'}
              </span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-foreground/90">{m.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="What are you working on?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSend()
            }
          }}
          className="h-9"
        />
        <Button size="sm" onClick={onSend} disabled={!draft.trim() || postMessage.isPending}>
          {postMessage.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}
