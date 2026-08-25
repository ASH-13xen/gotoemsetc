import type { AttendanceStatus } from '@/api/attendance.api'

// Per-status treatment shared by the calendar cells, the legend, and the
// summary/request panels — each status gets one hue since there are 7 of
// them and they need to stay visually distinct, just applied as a soft
// tint + dot rather than a heavy filled pill.
export const STATUS_CONFIG: Record<
  AttendanceStatus,
  { code: string; label: string; cell: string; dot: string; box: string }
> = {
  P: {
    code: 'P',
    label: 'Full Day',
    cell: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15',
    dot: 'bg-emerald-500',
    box: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
  },
  O: {
    code: 'O',
    label: 'Paid Leave',
    cell: 'bg-sky-500/10 text-sky-700 hover:bg-sky-500/15',
    dot: 'bg-sky-500',
    box: 'border-sky-500/25 bg-sky-500/10 text-sky-700',
  },
  H: {
    code: 'H',
    label: 'Half Day',
    cell: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15',
    dot: 'bg-amber-500',
    box: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
  },
  L: {
    code: 'L',
    label: 'Late',
    cell: 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/15',
    dot: 'bg-orange-500',
    box: 'border-orange-500/25 bg-orange-500/10 text-orange-700',
  },
  SL: {
    code: 'SL',
    label: 'Short Leave',
    cell: 'bg-red-500/10 text-red-700 hover:bg-red-500/15',
    dot: 'bg-red-500',
    box: 'border-red-500/25 bg-red-500/10 text-red-700',
  },
  W: {
    code: 'W',
    label: 'Work From Home',
    cell: 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/15',
    dot: 'bg-violet-500',
    box: 'border-violet-500/25 bg-violet-500/10 text-violet-700',
  },
  A: {
    code: 'A',
    label: 'Absent',
    cell: 'bg-neutral-500/10 text-neutral-600 hover:bg-neutral-500/15',
    dot: 'bg-neutral-500',
    box: 'border-neutral-500/25 bg-neutral-500/10 text-neutral-600',
  },
  HL: {
    code: 'HL',
    label: 'Holiday',
    cell: 'bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/15',
    dot: 'bg-cyan-500',
    box: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-700',
  },
}
