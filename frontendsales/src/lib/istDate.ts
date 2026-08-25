// Front-end counterpart of the backend's utils/istDate.js. The calendar is a
// civil calendar in India — a cell is "5 August in India", not an instant —
// so every date shown or sent has to be built in IST regardless of the
// viewer's own timezone. A user in another timezone must still see the same
// grid as the team in India.
const IST_OFFSET_MS = 330 * 60 * 1000

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// The UTC instant of a given IST wall-clock time. `month` is 1-based.
export function istInstant(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS)
}

export function istParts(date: string | Date) {
  const shifted = new Date(new Date(date).getTime() + IST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  }
}

// "2026-08-05" for the IST day — the key the API groups items by.
// Deliberately not toISOString().slice(0,10), which gives the UTC day and
// would put an 18:30 IST item on the previous date for viewers behind UTC.
export function istDateKey(date: string | Date): string {
  const { year, month, day } = istParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function istDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Which weekday the 1st falls on, as a Monday-first column offset — the grid
// starts weeks on Monday, matching how the team reads a work calendar.
export function firstWeekdayOffset(year: number, month: number): number {
  const sundayFirst = istParts(istInstant(year, month, 1, 12, 0)).weekday
  return (sundayFirst + 6) % 7
}

export function formatIstDate(date: string | Date): string {
  const { year, month, day } = istParts(date)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

export function formatIstDateTime(date: string | Date): string {
  const { hour, minute } = istParts(date)
  return `${formatIstDate(date)}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`
}

// Today in IST, for defaulting the month picker.
export function istToday() {
  return istParts(new Date())
}
