import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Loader2, MessageCircle, Send, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useClientChatLive } from '@/hooks/useClientChatLive'
import { usePostClientChatMessage } from '@/hooks/useClientChat'

// The main chat for a client — one thread shared by everyone on
// client.chatAllowedEmployees, not per-task.
export function ClientChatPanel({ clientId }: { clientId: string }) {
  const { messages, isLoading, error } = useClientChatLive(clientId)
  const postMessage = usePostClientChatMessage(clientId)
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

  const notAllowed = isAxiosError(error) && error.response?.status === 403

  if (notAllowed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center">
        <ShieldAlert className="size-6 text-muted-foreground" />
        <p className="text-sm font-semibold">You don't have access to this client's chat.</p>
        <p className="text-xs text-muted-foreground">Ask an admin to add you to the chat roster.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="size-4 text-primary" />
        <p className="text-sm font-bold">Client chat</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet — post an update below.</p>
        ) : (
          messages.map((m) => (
            <div key={m._id} className="text-sm">
              <span className="font-semibold">{m.sender ? `${m.sender.firstName} ${m.sender.lastName ?? ''}` : 'Admin'}</span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <p className="text-foreground/90">{m.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Input
          placeholder="Message the team about this client…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSend()
            }
          }}
        />
        <Button onClick={onSend} disabled={!draft.trim() || postMessage.isPending}>
          {postMessage.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
