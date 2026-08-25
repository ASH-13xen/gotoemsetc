export type AttendanceStatus = 'P' | 'O' | 'H' | 'L' | 'SL' | 'W' | 'A' | 'HL'

// Ported from frontendhr/src/components/attendance/statusConfig.ts (the
// calendar cells, legend, and who's-out dots there use the exact same
// hues) — kept in sync manually, same convention as this codebase's other
// small per-remote API/type copies.
export const STATUS_CONFIG: Record<AttendanceStatus, { label: string; cell: string; dot: string }> = {
  P: { label: 'P — Full Day', cell: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15', dot: 'bg-emerald-500' },
  O: { label: 'O — Paid Leave', cell: 'bg-sky-500/10 text-sky-700 hover:bg-sky-500/15', dot: 'bg-sky-500' },
  H: { label: 'H — Half Day', cell: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15', dot: 'bg-amber-500' },
  L: { label: 'L — Late', cell: 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/15', dot: 'bg-orange-500' },
  SL: { label: 'SL — Short Leave', cell: 'bg-red-500/10 text-red-700 hover:bg-red-500/15', dot: 'bg-red-500' },
  W: { label: 'W — Work From Home', cell: 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/15', dot: 'bg-violet-500' },
  A: { label: 'A — Absent', cell: 'bg-neutral-500/10 text-neutral-600 hover:bg-neutral-500/15', dot: 'bg-neutral-500' },
  HL: { label: 'HL — Holiday', cell: 'bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/15', dot: 'bg-cyan-500' },
}
