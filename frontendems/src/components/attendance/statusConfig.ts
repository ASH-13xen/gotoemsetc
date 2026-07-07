import type { AttendanceStatus } from '@/api/attendance.api'

// Bold, high-contrast per-status treatment for the pure-black theme —
// mirrors the border/tinted-fill/bright-text pattern used by Badge's
// success/warning/destructive variants.
export const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; cell: string; solid: string; dot: string }
> = {
  present: {
    label: 'Present',
    cell: 'border-emerald-500 bg-emerald-950/60 text-emerald-400',
    solid: 'border-emerald-500 bg-emerald-950/40 text-emerald-400',
    dot: 'bg-emerald-500',
  },
  absent: {
    label: 'Absent',
    cell: 'border-red-500 bg-red-950/60 text-red-400',
    solid: 'border-red-500 bg-red-950/40 text-red-400',
    dot: 'bg-red-500',
  },
  half_day: {
    label: 'Half Day',
    cell: 'border-amber-500 bg-amber-950/60 text-amber-400',
    solid: 'border-amber-500 bg-amber-950/40 text-amber-400',
    dot: 'bg-amber-500',
  },
  leave: {
    label: 'Leave',
    cell: 'border-sky-500 bg-sky-950/60 text-sky-400',
    solid: 'border-sky-500 bg-sky-950/40 text-sky-400',
    dot: 'bg-sky-500',
  },
  work_from_home: {
    label: 'Work From Home',
    cell: 'border-violet-500 bg-violet-950/60 text-violet-400',
    solid: 'border-violet-500 bg-violet-950/40 text-violet-400',
    dot: 'bg-violet-500',
  },
  short_day: {
    label: 'Short Day',
    cell: 'border-orange-500 bg-orange-950/60 text-orange-400',
    solid: 'border-orange-500 bg-orange-950/40 text-orange-400',
    dot: 'bg-orange-500',
  },
  early_leave: {
    label: 'Early Leave',
    cell: 'border-pink-500 bg-pink-950/60 text-pink-400',
    solid: 'border-pink-500 bg-pink-950/40 text-pink-400',
    dot: 'bg-pink-500',
  },
}
