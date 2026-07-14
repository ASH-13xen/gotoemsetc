import { useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { useTaskMessages } from './useTasks'
import type { TaskMessage } from '@/api/tasks.api'

// REST loads history on mount; the socket room delivers anything sent while
// this component is open, appended live — the "like a chat app" behavior.
export function useTaskChat(taskId: string | undefined) {
  const { data, isLoading } = useTaskMessages(taskId)
  const [liveMessages, setLiveMessages] = useState<TaskMessage[]>([])

  useEffect(() => {
    setLiveMessages([])
    if (!taskId) return undefined

    const socket = getSocket()
    if (!socket.connected) socket.connect()

    socket.emit('task:join', taskId, (res?: { error?: string }) => {
      if (res?.error) console.error('task:join failed', res.error)
    })

    const onMessage = (message: TaskMessage) => {
      if (message.task === taskId) setLiveMessages((prev) => [...prev, message])
    }
    socket.on('task:message', onMessage);

    return () => {
      socket.off('task:message', onMessage)
      socket.emit('task:leave', taskId)
    }
  }, [taskId])

  const history = data?.messages ?? []
  // Drop any live message that's already in the REST history (e.g. our own
  // just-posted message, once the query refetches).
  const historyIds = new Set(history.map((m) => m._id))
  const messages = [...history, ...liveMessages.filter((m) => !historyIds.has(m._id))]

  return { messages, isLoading }
}
