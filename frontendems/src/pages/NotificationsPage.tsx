import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-16 text-center">
          <Bell className="size-10 text-muted-foreground/40" />
          <p className="text-base font-semibold text-foreground">No notifications yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification._id}
              onClick={() => onClickNotification(notification)}
              className={cn(
                'flex cursor-pointer items-start gap-4 p-4 transition-colors hover:bg-secondary/40',
                !notification.isRead && 'bg-primary/5'
              )}
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{notification.title}</p>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground/70">{formatWhen(notification.createdAt)}</p>
              </div>
              {!notification.isRead && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
