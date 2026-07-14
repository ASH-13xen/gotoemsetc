import { io, type Socket } from 'socket.io-client'
import { getToken } from './authStorage'

// Socket.io connects to the backend's bare origin (not the REST /api path —
// it upgrades its own /socket.io/ path on the same server) — same
// VITE_API_URL env var the REST client uses, just without the /api suffix.
function resolveSocketUrl(): string {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:5050'
  return raw.replace(/\/+$/, '').replace(/\/api$/, '')
}

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      auth: { token: getToken() },
      autoConnect: false,
    })
  }
  return socket
}
