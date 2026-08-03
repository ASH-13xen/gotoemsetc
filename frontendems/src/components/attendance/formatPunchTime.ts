// Biometric scans are IST-based (see backend's attendanceClassifier
// service) — format explicitly in that zone rather than the viewer's local
// one, so the displayed time always matches what actually happened on the
// device regardless of who's looking at the report.
export function formatPunchTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
}
