import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { canAccessFinance } from '@/lib/roles'
import { SalaryTab } from '@/components/salary/SalaryTab'
import { FnfTab } from '@/components/fnf/FnfTab'
import { InvoicingTab } from '@/components/invoicing/InvoicingTab'
import { BillsTab } from '@/components/bills/BillsTab'
import { ReimbursementsTab } from '@/components/reimbursements/ReimbursementsTab'

// Five independent sections, one page — same tabbed-detail-page pattern as
// frontendsales's ClientDetailPage (Overview/Calendars/Manual/Meetings).
// Operations Manager reaches this remote (see RequireFinanceAccess) but only
// for Monthly Bills — every other tab is hidden for that role rather than
// merely disabled, since the backend rejects those calls outright.
export default function FinancePage() {
  const { user } = useAuth()
  const fullAccess = canAccessFinance(user)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-8">
      <PageHeader
        eyebrow="Finance"
        title="Finance"
        description="Salary, FnF settlements, client invoicing, monthly bills, and employee reimbursements."
      />

      <Tabs defaultValue={fullAccess ? 'salary' : 'bills'}>
        <TabsList>
          {fullAccess && <TabsTrigger value="salary">Salary</TabsTrigger>}
          {fullAccess && <TabsTrigger value="fnf">FnF</TabsTrigger>}
          {fullAccess && <TabsTrigger value="invoicing">Invoicing</TabsTrigger>}
          <TabsTrigger value="bills">Monthly Bills</TabsTrigger>
          {fullAccess && <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>}
        </TabsList>

        {fullAccess && (
          <TabsContent value="salary">
            <SalaryTab />
          </TabsContent>
        )}
        {fullAccess && (
          <TabsContent value="fnf">
            <FnfTab />
          </TabsContent>
        )}
        {fullAccess && (
          <TabsContent value="invoicing">
            <InvoicingTab />
          </TabsContent>
        )}
        <TabsContent value="bills">
          <BillsTab />
        </TabsContent>
        {fullAccess && (
          <TabsContent value="reimbursements">
            <ReimbursementsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
