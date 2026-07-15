import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { useClientChatMessages } from './useClientChat'
import type { ClientChatMessage } from '@/api/clientChat.api'

// REST loads history on mount; the socket room delivers anything sent while
// this component is open, appended live — the "like a chat app" behavior.
// Chat is per-client (not per-task) — one room per client.
export function useClientChatLive(clientId: string | undefined) {
  const { data, isLoading, error } = useClientChatMessages(clientId)
  const [liveMessages, setLiveMessages] = useState<ClientChatMessage[]>([])

  useEffect(() => {
    setLiveMessages([])
    if (!clientId) return undefined

    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('client:join', clientId, (res?: { error?: string }) => {
      if (res?.error) console.error('client:join failed', res.error)
    })

    const onMessage = (message: ClientChatMessage) => {
      if (message.client === clientId) setLiveMessages((prev) => [...prev, message])
    }
    socket.on('client:message', onMessage)

    return () => {
      socket.off('client:message', onMessage)
      socket.emit('client:leave', clientId)
    }
  }, [clientId])

  const history = data?.messages ?? []
  // Drop any live message that's already in the REST history (e.g. our own
  // just-posted message, once the query refetches).
  const historyIds = new Set(history.map((m) => m._id))
  const messages = [...history, ...liveMessages.filter((m) => !historyIds.has(m._id))]

  return { messages, isLoading, error }
}
