import type { BirthdayEmployee } from '@/api/birthdays.api'

export interface BirthdayEntry {
  id: string
  name: string
  employeeCode?: string
  dob: Date
}

export function toBirthdayEntries(employees: BirthdayEmployee[]): BirthdayEntry[] {
  return employees
    .filter((e) => e.dob)
    .map((e) => ({
      id: e._id,
      name: `${e.firstName} ${e.lastName ?? ''}`.trim(),
      employeeCode: e.employeeCode,
      dob: new Date(e.dob),
    }))
}

export function monthDayKey(month: number, day: number): string {
  return `${month}-${day}`
}

export function groupByMonthDay(entries: BirthdayEntry[]): Map<string, BirthdayEntry[]> {
  const map = new Map<string, BirthdayEntry[]>()
  for (const entry of entries) {
    const key = monthDayKey(entry.dob.getMonth(), entry.dob.getDate())
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(entry)
  }
  return map
}

// Next occurrence of this birthday relative to `today` — this year's date
// if it hasn't passed yet, otherwise next year's.
export function nextOccurrence(dob: Date, today: Date): Date {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (next < todayMidnight) {
    next.setFullYear(next.getFullYear() + 1)
  }
  return next
}

export function daysUntil(target: Date, today: Date): number {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
}
