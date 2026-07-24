import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import type { Notification } from '@/api/notifications.api'

function formatWhen(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const notifications = data?.notifications ?? []
  const unreadCount = notifications.filter((n) => !n.isRead).length

  const onClickNotification = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification._id)
    if (notification.employee) navigate(`/employees/${notification.employee}`)
  }

  return (
    <div className="space-y-8 py-4">
      <main className="mx-auto max-w-3xl space-y-8">
        <div className="bg-card/90 backdrop-blur-md p-8 rounded-2xl flex items-center justify-between shadow-diffuse">
          <div className="flex items-center gap-3">
            <Bell className="size-6 text-foreground" />
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Notifications</h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="p-16 flex flex-col items-center gap-3 text-center">
            <Bell className="size-12 text-muted-foreground/40" />
            <p className="text-lg font-bold text-foreground">No notifications yet</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notification) => (
              <Card
                key={notification._id}
                onClick={() => onClickNotification(notification)}
                className={cn(
                  'p-5 flex items-start gap-4 cursor-pointer transition-colors hover:bg-secondary/40',
                  !notification.isRead && 'border-l-4 border-l-primary bg-primary/5'
                )}
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-bold text-foreground">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {formatWhen(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead && <span className="mt-1 size-2 rounded-full bg-primary shrink-0" />}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
