import { useState } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: countData } = useUnreadNotificationCount()
  const { data, isLoading } = useNotifications(open)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = countData?.count ?? 0
  const notifications = data?.notifications ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-bold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                className={cn(
                  'flex items-start gap-2 border-b border-border/60 px-4 py-3 last:border-b-0',
                  !notification.isRead && 'bg-primary/5'
                )}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(notification.createdAt)}</p>
                </div>
                {!notification.isRead && (
                  <button
                    onClick={() => markRead.mutate(notification._id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    title="Mark as read"
                  >
                    <Check className="size-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
