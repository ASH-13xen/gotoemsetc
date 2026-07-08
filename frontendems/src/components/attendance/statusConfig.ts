import type { AttendanceStatus } from '@/api/attendance.api'

// Bold, high-contrast per-status treatment for the pure-black theme —
// mirrors the border/tinted-fill/bright-text pattern used by Badge's
// success/warning/destructive variants.
export const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; cell: string; solid: string; dot: string }
> = {
  P: {
    label: 'P — Full Day',
    cell: 'border-emerald-500 bg-emerald-950/60 text-emerald-400',
    solid: 'border-emerald-500 bg-emerald-950/40 text-emerald-400',
    dot: 'bg-emerald-500',
  },
  O: {
    label: 'O — Paid Leave',
    cell: 'border-sky-500 bg-sky-950/60 text-sky-400',
    solid: 'border-sky-500 bg-sky-950/40 text-sky-400',
    dot: 'bg-sky-500',
  },
  H: {
    label: 'H — Half Day',
    cell: 'border-amber-500 bg-amber-950/60 text-amber-400',
    solid: 'border-amber-500 bg-amber-950/40 text-amber-400',
    dot: 'bg-amber-500',
  },
  L: {
    label: 'L — Late',
    cell: 'border-orange-500 bg-orange-950/60 text-orange-400',
    solid: 'border-orange-500 bg-orange-950/40 text-orange-400',
    dot: 'bg-orange-500',
  },
  SL: {
    label: 'SL — Short Leave',
    cell: 'border-red-500 bg-red-950/60 text-red-400',
    solid: 'border-red-500 bg-red-950/40 text-red-400',
    dot: 'bg-red-500',
  },
  W: {
    label: 'W — Work From Home',
    cell: 'border-violet-500 bg-violet-950/60 text-violet-400',
    solid: 'border-violet-500 bg-violet-950/40 text-violet-400',
    dot: 'bg-violet-500',
  },
}
