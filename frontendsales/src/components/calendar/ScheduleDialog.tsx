import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useScheduleItem } from '@/hooks/useCms'
import type { CalendarView, ContentType, FestiveWorkflow } from '@/api/cms.api'
import { formatIstDate } from '@/lib/istDate'

const TYPE_OPTIONS: Array<{ value: ContentType; label: string; hint: string }> = [
  { value: 'post', label: 'Post', hint: 'Starts orange. One assigned social media manager, then Team Leader approval, then client.' },
  { value: 'reel', label: 'Reel', hint: 'Starts yellow. Videographer → Editor → SMM → Content Manager → Team Leader → client.' },
  { value: 'story', label: 'Daily story', hint: 'Starts brown. Goes to the team’s tagged social media manager(s), then Team Leader.' },
  { value: 'festive_story', label: 'Festive story', hint: 'Follows the Post or Reel pipeline, your choice below.' },
]

export function ScheduleDialog({
  open,
  onOpenChange,
  view,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: CalendarView
  defaultDate: Date
}) {
  const schedule = useScheduleItem(view.calendar._id)
  const [type, setType] = useState<ContentType>('post')
  const [festiveWorkflow, setFestiveWorkflow] = useState<FestiveWorkflow>('post')
  const [designer, setDesigner] = useState('')
  const [shooter, setShooter] = useState('')
  const [editor, setEditor] = useState('')
  const [contentManager, setContentManager] = useState('')
  const [brief, setBrief] = useState({
    postingName: '',
    postingLink: '',
    collabsAndTags: '',
    caption: '',
    uploadDestination: '',
  })

  // Anyone on the team can be assigned, Team Main included — Team Main is
  // deliberately not listed in `members`, so they have to be added back here.
  const roster = [
    ...(view.calendar.team?.leader ? [view.calendar.team.leader] : []),
    ...(view.calendar.team?.members ?? []),
  ]

  const effectiveKind = type === 'festive_story' ? festiveWorkflow : type
  const isReel = effectiveKind === 'reel'
  const isPost = effectiveKind === 'post'
  const isStory = type === 'story'

  const ready = isStory ? true : isReel ? Boolean(shooter && editor && contentManager) : Boolean(designer)

  function submit() {
    schedule.mutate(
      {
        type,
        festiveWorkflow: type === 'festive_story' ? festiveWorkflow : undefined,
        scheduledDate: defaultDate.toISOString(),
        assignments: isStory ? {} : isReel ? { shooter, editor, contentManager } : { designer },
        brief: Object.fromEntries(Object.entries(brief).filter(([, v]) => v.trim())),
      },
      {
        onSuccess: () => {
          setDesigner('')
          setShooter('')
          setEditor('')
          setContentManager('')
          setBrief({ postingName: '', postingLink: '', collabsAndTags: '', caption: '', uploadDestination: '' })
          onOpenChange(false)
        },
      }
    )
  }

  const rolesFor = (employeeId: string) =>
    view.calendar.team?.memberRoles?.find((r) => r.employee._id === employeeId)?.roles ?? []

  const person = (id: string, set: (v: string) => void, label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={id} onValueChange={set}>
        <SelectTrigger>
          <SelectValue placeholder="Pick someone" />
        </SelectTrigger>
        <SelectContent>
          {roster.map((e) => (
            <SelectItem key={e._id} value={e._id}>
              {e.firstName} {e.lastName ?? ''}
              {rolesFor(e._id).includes('social_media_manager') && ' — SMM'}
              {e._id === view.calendar.team?.leader?._id && ' — Team Main'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const briefField = (key: keyof typeof brief, label: string) => (
    <div className="space-y-2">
      <Label htmlFor={`brief-${key}`}>{label}</Label>
      <Input
        id={`brief-${key}`}
        value={brief[key]}
        onChange={(e) => setBrief((b) => ({ ...b, [key]: e.target.value }))}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule for {formatIstDate(defaultDate)}</DialogTitle>
          <DialogDescription>
            Everything below except the type and assignee(s) can be filled in later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TYPE_OPTIONS.find((o) => o.value === type)?.hint}
            </p>
          </div>

          {type === 'festive_story' && (
            <div className="space-y-2">
              <Label>Follows which pipeline?</Label>
              <Select value={festiveWorkflow} onValueChange={(v) => setFestiveWorkflow(v as FestiveWorkflow)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Post pipeline</SelectItem>
                  <SelectItem value="reel">Reel pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isStory ? (
            <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
              Routed to every team member currently tagged Social Media Manager — no assignee to pick here.
            </p>
          ) : isReel ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {person(shooter, setShooter, 'Videographer')}
              {person(editor, setEditor, 'Editor')}
              {person(contentManager, setContentManager, 'Content Manager')}
            </div>
          ) : (
            person(designer, setDesigner, isPost ? 'Social Media Manager' : 'Assignee')
          )}

          <div className="space-y-4 rounded-xl border border-border/40 p-4">
            <p className="text-sm font-medium">Details (optional)</p>
            {briefField('postingName', 'Posting name')}
            {briefField('postingLink', 'Posting link')}
            {briefField('collabsAndTags', 'Collabs + tags')}
            {briefField('uploadDestination', 'Where it will be uploaded')}
            <div className="space-y-2">
              <Label htmlFor="brief-caption">Caption</Label>
              <Textarea
                id="brief-caption"
                rows={3}
                value={brief.caption}
                onChange={(e) => setBrief((b) => ({ ...b, caption: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || schedule.isPending}>
            {schedule.isPending ? 'Scheduling…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
