import { PageHeader } from '@/components/layout/PageHeader'
import { UpcomingCalendarWidget } from '@/components/calendar/UpcomingCalendarWidget'
import { CompanyCalendarGrid } from '@/components/calendar/CompanyCalendarGrid'

export default function CompanyCalendarPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Company-wide"
        title="Calendar"
        description="Holidays, half days, client & employee dates, and approved leave — everyone's view of who's off and when."
      />
      <UpcomingCalendarWidget />
      <CompanyCalendarGrid />
    </div>
  )
}
