import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import { Check, Inbox, Repeat, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CalEvent } from '@/api/weeklyCalendar.api'
import { useInvites, useRespond } from '@/hooks/useWeeklyCalendar'
import { CATEGORY, apiError, fmtWhen } from './calendarUtils'
import { Avatar } from './PeoplePicker'

// Pending invites, newest dates first — accept or decline right here, or
// open one to see who else is coming.
export function InvitesTray({ onOpen }: { onOpen: (event: CalEvent) => void }) {
  const { data: invites = [] } = useInvites()
  const respond = useRespond()
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !listRef.current) return
    gsap.fromTo(listRef.current.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'power2.out', clearProps: 'transform,opacity' })
  }, [open])

  const reply = (event: CalEvent, response: 'accept' | 'decline') =>
    respond
      .mutateAsync({ id: event._id, response, scope: (event.seriesSize ?? 1) > 1 ? 'series' : 'one' })
      .then((r) => {
        toast.success(response === 'accept' ? `Accepted “${event.title}”${r.updated > 1 ? ` · ${r.updated} dates` : ''}` : `Declined “${event.title}”`)
        r.skipped.forEach((s) => toast.warning(`Skipped ${s}`))
      })
      .catch((err) => toast.error(apiError(err, 'Could not respond')))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2 rounded-xl">
          <Inbox className="size-4" />
          Invites
          {invites.length > 0 && (
            <span className="relative flex size-5 items-center justify-center">
              <span className="wc-badge-ping absolute inset-0 rounded-full bg-rose-500/60" />
              <span className="relative flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">{invites.length}</span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Invites</p>
          <p className="text-[11px] text-muted-foreground">Accepting blocks the time on your calendar.</p>
        </div>
        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-2">
          {invites.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">You're all caught up ✨</p>
          ) : (
            invites.map((event) => {
              const meta = CATEGORY[event.category ?? 'other']
              return (
                <div key={event._id} className="mb-1.5 overflow-hidden rounded-2xl border border-border bg-background last:mb-0">
                  <button type="button" onClick={() => (setOpen(false), onOpen(event))} className="flex w-full items-start gap-2.5 px-3 pt-2.5 text-left">
                    <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: `linear-gradient(${meta.from}, ${meta.to})` }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{event.title}</span>
                      <span className="block text-[11px] font-semibold text-primary">
                        {fmtWhen(event)}
                        {(event.seriesSize ?? 1) > 1 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
                            <Repeat className="size-3" /> +{(event.seriesSize ?? 1) - 1} more
                          </span>
                        )}
                      </span>
                      {event.host && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Avatar person={event.host} size="size-4" className="text-[7px]" /> from {event.host.name}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex gap-1.5 p-2.5 pt-2">
                    <Button size="sm" className="h-8 flex-1 bg-emerald-600 text-white hover:bg-emerald-700" disabled={respond.isPending} onClick={() => reply(event, 'accept')}>
                      <Check className="size-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 flex-1" disabled={respond.isPending} onClick={() => reply(event, 'decline')}>
                      <X className="size-3.5" /> Decline
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
