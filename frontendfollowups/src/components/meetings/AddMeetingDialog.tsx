import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCreateMeeting } from '@/hooks/useMeetings'
import { useEmployeeDirectory } from '@/hooks/useEmployees'

function nowValue() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function AddMeetingDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [mom, setMom] = useState('')
  const [meetingDate, setMeetingDate] = useState(nowValue())
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])

  const { data: employeesData, isLoading: employeesLoading } = useEmployeeDirectory()
  const createMeeting = useCreateMeeting(clientId)
  const employees = employeesData?.items ?? []

  const reset = () => {
    setMom('')
    setMeetingDate(nowValue())
    setAttendeeIds([])
  }

  const onSubmit = () => {
    if (!mom.trim()) {
      toast.error('Please add the minutes of meeting')
      return
    }
    createMeeting.mutate(
      { mom, meetingDate: new Date(meetingDate).toISOString(), attendees: attendeeIds },
      {
        onSuccess: () => {
          toast.success('Meeting logged')
          reset()
          setOpen(false)
        },
        onError: () => toast.error('Could not save meeting'),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
          <Plus className="size-4" />
          Log Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border-2 border-white bg-black text-white">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Log a Meeting</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Record the minutes of meeting and who was involved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-xs font-black tracking-widest text-neutral-400 uppercase">
              Meeting Date & Time
            </Label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="h-11 border-2 border-white bg-black px-3 text-sm font-bold text-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-black tracking-widest text-neutral-400 uppercase">
              Minutes of Meeting (MOM)
            </Label>
            <Textarea
              value={mom}
              onChange={(e) => setMom(e.target.value)}
              placeholder="What was discussed, decided, next steps…"
              className="min-h-28 rounded-none border-2 border-white bg-black text-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-black tracking-widest text-neutral-400 uppercase">
              Employees Involved
            </Label>
            <div className="max-h-48 overflow-y-auto border-2 border-white">
              {employeesLoading ? (
                <p className="p-3 text-sm text-neutral-400">Loading employees…</p>
              ) : employees.length === 0 ? (
                <p className="p-3 text-sm text-neutral-400">No employees found.</p>
              ) : (
                employees.map((emp) => {
                  const selected = attendeeIds.includes(emp._id)
                  return (
                    <button
                      key={emp._id}
                      type="button"
                      onClick={() =>
                        setAttendeeIds((prev) =>
                          prev.includes(emp._id) ? prev.filter((id) => id !== emp._id) : [...prev, emp._id]
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-2 border-b-2 border-neutral-900 p-3 text-left last:border-b-0 hover:bg-neutral-900',
                        selected && 'bg-neutral-900'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center border-2',
                          selected ? 'border-primary bg-primary' : 'border-white'
                        )}
                      >
                        {selected && <Check className="size-3 text-white" />}
                      </span>
                      <span className="text-sm font-bold uppercase tracking-wide">
                        {emp.firstName} {emp.lastName}
                      </span>
                      <span className="text-xs text-neutral-400">· {emp.designation}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={createMeeting.isPending}
          >
            {createMeeting.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
