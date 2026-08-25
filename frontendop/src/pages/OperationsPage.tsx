import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { QuickActions, QuickActionItem } from '@/components/layout/QuickActions'

export default function OperationsPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="Operations"
        title="Operations"
        description="Facilities complaints and other operational tooling — the admin/CEO/Operations-Manager-only toolkit."
      />

      <QuickActions>
        <QuickActionItem
          icon={<ClipboardList className="size-4" />}
          label="Complaint register"
          description="Review, complete, track feedback"
          onClick={() => navigate('/complaints')}
        />
      </QuickActions>
    </div>
  )
}
