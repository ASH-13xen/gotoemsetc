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
    cell: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20',
    solid: 'bg-emerald-500/10 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  O: {
    label: 'O — Paid Leave',
    cell: 'border-sky-500/20 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20',
    solid: 'bg-sky-500/10 text-sky-700',
    dot: 'bg-sky-500',
  },
  H: {
    label: 'H — Half Day',
    cell: 'border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20',
    solid: 'bg-amber-500/10 text-amber-700',
    dot: 'bg-amber-500',
  },
  L: {
    label: 'L — Late',
    cell: 'border-orange-500/20 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20',
    solid: 'bg-orange-500/10 text-orange-700',
    dot: 'bg-orange-500',
  },
  SL: {
    label: 'SL — Short Leave',
    cell: 'border-red-500/20 bg-red-500/10 text-red-700 hover:bg-red-500/20',
    solid: 'bg-red-500/10 text-red-700',
    dot: 'bg-red-500',
  },
  W: {
    label: 'W — Work From Home',
    cell: 'border-violet-500/20 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20',
    solid: 'bg-violet-500/10 text-violet-700',
    dot: 'bg-violet-500',
  },
}
