import { useNavigate } from 'react-router-dom'
import { CalendarRange, ClipboardList, FileStack, HardDrive, Inbox, Timer } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'
import { DailyReportModal } from '@/components/attendance/DailyReportModal'

export default function HrWorkPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HRMS"
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
          icon={<Timer className="size-4" />}
          label="Overtime requests"
          description="Approve, reject, history"
          onClick={() => navigate('/overtime-requests')}
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
