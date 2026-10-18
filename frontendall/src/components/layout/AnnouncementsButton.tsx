import { useEffect, useState } from 'react'
import { Check, Clock, Flag, Megaphone, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useAcknowledgeAnnouncement, useMyPendingAnnouncements, useSeeAnnouncementLater } from '@/hooks/useAnnouncements'
import type { PendingAnnouncement } from '@/api/announcements.api'
import { cn } from '@/lib/utils'

const SHOWN_KEY = 'announcements:auto-shown'

// Ids that have already opened by themselves this session.
function readShown(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function writeShown(ids: Set<string>) {
  try {
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...ids]))
  } catch {
    // storage may be unavailable — it just opens again next time
  }
}

// Announcements, next to the notification bell. They no longer block the
// screen: the panel opens by itself once when something new arrives, and
// this button shows or hides it. Each one is either acknowledged (gone) or
// put aside with "Later" — it stays here, counted on the button, but won't
// open by itself again. Flags someone receives arrive here too.
export function AnnouncementsButton() {
  const { user } = useAuth()
  const hasEmployee = Boolean(user?.employeeLink)
  const { data } = useMyPendingAnnouncements(hasEmployee)
  const acknowledge = useAcknowledgeAnnouncement()
  const later = useSeeAnnouncementLater()
  const [open, setOpen] = useState(false)
  const announcements = data?.announcements ?? []
  const fresh = announcements.filter((a) => !a.later)
  const saved = announcements.filter((a) => a.later)

  // New ones open the panel once (per browser session) — never again after
  // it's closed, unless something newer arrives.
  useEffect(() => {
    const shown = readShown()
    const unseen = fresh.filter((a) => !shown.has(a._id))
    if (unseen.length === 0) return
    unseen.forEach((a) => shown.add(a._id))
    writeShown(shown)
    setOpen(true)
  }, [fresh.map((a) => a._id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasEmployee) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Announcements${announcements.length ? ` — ${announcements.length}` : ''}`}
        title="Announcements"
      >
        <Megaphone className="size-4" />
        {announcements.length > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white',
              fresh.length ? 'bg-violet-600' : 'bg-muted-foreground'
            )}
          >
            {announcements.length > 9 ? '9+' : announcements.length}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-violet-600" /> Announcements
            </DialogTitle>
            <DialogDescription>
              {announcements.length === 0
                ? "You're all caught up."
                : 'Acknowledge each one, or keep it for later — it stays here until you do.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {fresh.map((a) => (
              <AnnouncementItem key={a._id} a={a} busy={acknowledge.isPending || later.isPending} onAck={() => acknowledge.mutate(a._id)} onLater={() => later.mutate(a._id)} />
            ))}
            {saved.length > 0 && (
              <>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  <Clock className="size-3" /> Kept for later · {saved.length}
                </p>
                {saved.map((a) => (
                  <AnnouncementItem key={a._id} a={a} busy={acknowledge.isPending} onAck={() => acknowledge.mutate(a._id)} />
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AnnouncementItem({ a, busy, onAck, onLater }: { a: PendingAnnouncement; busy: boolean; onAck: () => void; onLater?: () => void }) {
  const flag = a.kind === 'performance_flag'
  return (
    <div
      className={cn(
        'rounded-xl p-4',
        flag ? (a.flagColor === 'red' ? 'border border-red-500/30 bg-red-500/8' : 'border border-emerald-500/30 bg-emerald-500/8') : 'bg-secondary/40'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          {flag && (a.flagColor === 'red' ? <Flag className="size-4 text-red-600" /> : <Trophy className="size-4 text-emerald-600" />)}
          {a.title}
        </p>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{new Date(a.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap text-foreground">{a.message}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" onClick={onAck} disabled={busy}>
          <Check className="size-3.5" /> Acknowledge
        </Button>
        {onLater && (
          <Button size="sm" variant="outline" className="flex-1" onClick={onLater} disabled={busy}>
            <Clock className="size-3.5" /> Later
          </Button>
        )}
      </div>
    </div>
  )
}
