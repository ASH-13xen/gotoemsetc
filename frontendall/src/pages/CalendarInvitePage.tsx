import { useLayoutEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { CalendarCheck2, CalendarRange, CalendarX2, Check, Link2, Loader2, MapPin, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPublicInvite, respondPublic } from '@/api/weeklyCalendar.api'
import { Avatar } from '@/components/weeklyCalendar/PeoplePicker'
import { CATEGORY, apiError, firstName, fmtWhen } from '@/components/weeklyCalendar/calendarUtils'
import '@/components/weeklyCalendar/weeklyCalendar.css'

// Opened from the invite email's Accept / Decline buttons — no login
// needed; the link itself says which invite and whose. Nothing happens
// until a button here is pressed (mail scanners open links too).
export default function CalendarInvitePage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const preferred = params.get('action') === 'decline' ? 'decline' : 'accept'
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<null | { response: 'accept' | 'decline'; updated: number; skipped: string[] }>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const { data: invite, isLoading, error } = useQuery({ queryKey: ['public-invite', token], queryFn: () => getPublicInvite(token), retry: false })
  const reply = useMutation({
    mutationFn: (response: 'accept' | 'decline') => respondPublic(token, { response, reason: reason.trim() || undefined }),
    onSuccess: (result, response) => setDone({ response, ...result }),
  })

  useLayoutEffect(() => {
    if (!cardRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current, { y: 30, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' })
      gsap.fromTo('.inv-item', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, delay: 0.15, ease: 'power2.out', clearProps: 'transform,opacity' })
    }, cardRef)
    return () => ctx.revert()
  }, [invite, done])

  const meta = CATEGORY[invite?.category ?? 'other']

  return (
    <div className="wc-page flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div ref={cardRef} className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-[0_40px_90px_-40px_rgba(79,70,229,0.55)]">
        <div className="relative overflow-hidden px-7 pt-7 pb-6 text-white" style={{ background: 'linear-gradient(120deg, #6366f1, #a855f7)' }}>
          <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase opacity-90">
            <CalendarRange className="size-3.5" /> Weekly Calendar
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            {done ? (done.response === 'accept' ? "You're in!" : 'Declined') : invite ? `Hi ${firstName(invite.invitee)}, you're invited` : 'Your invite'}
          </h1>
        </div>

        <div className="px-7 py-6">
          {isLoading && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {error && <p className="py-6 text-center text-sm text-muted-foreground">{apiError(error, 'This invite link is invalid or has expired.')}</p>}

          {invite && (
            <>
              <div className="inv-item rounded-2xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: `linear-gradient(${meta.from}, ${meta.to})` }} />
                  <div className="min-w-0">
                    <p className="text-lg leading-tight font-black text-foreground">{invite.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Avatar person={invite.host} size="size-4" className="text-[7px]" /> Hosted by {invite.host.name}
                    </p>
                  </div>
                </div>
                {invite.description && <p className="mt-3 text-sm whitespace-pre-line text-foreground">{invite.description}</p>}
                {invite.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" /> {invite.location}
                  </p>
                )}
                {invite.link && (
                  <a href={invite.link} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-primary">
                    <Link2 className="size-3.5" /> {invite.link}
                  </a>
                )}
                <div className="mt-3 grid gap-1">
                  {invite.occurrences.map((o) => (
                    <div key={`${o.day}-${o.startMin}`} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-1.5 text-sm font-semibold">
                      {fmtWhen(o)}
                      {o.status === 'accepted' && <Check className="size-4 text-emerald-600" />}
                    </div>
                  ))}
                </div>
                {invite.attendees.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {invite.attendees.slice(0, 6).map((p) => (
                        <Avatar key={p._id} person={p} size="size-6" className="text-[8px] ring-2 ring-card" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{invite.attendees.length} going</span>
                  </div>
                )}
              </div>

              {invite.cancelled ? (
                <p className="inv-item mt-5 flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-muted-foreground">
                  <CalendarX2 className="size-4" /> This was cancelled by the host.
                </p>
              ) : done ? (
                <div className="inv-item mt-5 grid gap-2 text-center">
                  <span
                    className={`mx-auto flex size-14 items-center justify-center rounded-full ${done.response === 'accept' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}
                  >
                    {done.response === 'accept' ? <CalendarCheck2 className="size-7" /> : <X className="size-7" />}
                  </span>
                  <p className="text-sm font-semibold">
                    {done.response === 'accept'
                      ? `It's blocked on your Weekly Calendar${done.updated > 1 ? ` for ${done.updated} dates` : ''}.`
                      : `${firstName(invite.host)} has been told you can't make it.`}
                  </p>
                  {done.skipped.map((s) => (
                    <p key={s} className="text-xs text-amber-600">
                      Skipped {s}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="inv-item mt-5 grid gap-2.5">
                  {preferred === 'decline' && (
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — the host will see it" className="h-10" />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      className={`flex-1 bg-emerald-600 text-white hover:bg-emerald-700 ${preferred === 'accept' ? 'ring-4 ring-emerald-500/25' : ''}`}
                      disabled={reply.isPending}
                      onClick={() => reply.mutate('accept')}
                    >
                      <Check className="size-4" /> Accept
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className={`flex-1 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 ${preferred === 'decline' ? 'ring-4 ring-rose-500/20' : ''}`}
                      disabled={reply.isPending}
                      onClick={() => reply.mutate('decline')}
                    >
                      <X className="size-4" /> Decline
                    </Button>
                  </div>
                  {reply.error && <p className="text-center text-xs text-rose-600">{apiError(reply.error, 'Could not save your reply')}</p>}
                  {invite.status && invite.status !== 'invited' && (
                    <p className="text-center text-xs text-muted-foreground">You already {invite.status} this — you can change your answer.</p>
                  )}
                </div>
              )}
              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                You can also reply from <a href="/calendar" className="font-semibold text-primary">your Weekly Calendar</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
