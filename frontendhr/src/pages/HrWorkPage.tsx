import { useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarRange, ClipboardList, FileStack, HardDrive, Inbox } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'
import { DailyReportModal } from '@/components/attendance/DailyReportModal'

export default function HrWorkPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="HR Work"
        description="Attendance review, payroll, documents, and inventory — the admin/HR/CEO-only toolkit."
      />

      <QuickActions>
        <DailyReportModal
          trigger={
            <QuickActionItem
              icon={<ClipboardList className="size-4" />}
              label="Daily report"
              description="Lates, absents & more"
            />
          }
        />
        <QuickActionItem
          icon={<Inbox className="size-4" />}
          label="Leave/Modification requests"
          description="Approve, reject, revoke"
          onClick={() => navigate('/leave-applications')}
        />
        <QuickActionItem
          icon={<CalendarDays className="size-4" />}
          label="Company Calendar"
          description="Festive days, half days & leave"
          // Full-page navigation, not useNavigate() — /calendar lives in
          // frontendall, outside this remote's own isolated
          // <BrowserRouter basename="/hr">, so the inner router can't reach
          // it. Same technique this remote's own 401 redirect already uses
          // (see api/client.ts).
          onClick={() => window.location.assign('/calendar')}
        />
        <QuickActionItem
          icon={<FileStack className="size-4" />}
          label="Generate salary slips"
          description="All employees, one period"
          onClick={() => navigate('/salary-slips/bulk')}
        />
        <QuickActionItem
          icon={<CalendarRange className="size-4" />}
          label="All merged attendance"
          description="Org-wide monthly overview"
          onClick={() => navigate('/attendance/overview')}
        />
        <QuickActionItem
          icon={<FileStack className="size-4" />}
          label="Generated documents"
          description="By template, by employee"
          onClick={() => navigate('/documents/overview')}
        />
        <QuickActionItem
          icon={<HardDrive className="size-4" />}
          label="Inventory details"
          description="Column-picker report"
          onClick={() => navigate('/inventory')}
        />
      </QuickActions>
    </div>
  )
}
