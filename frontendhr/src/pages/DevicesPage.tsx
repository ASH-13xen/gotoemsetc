import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { devicesApi } from '@/api/devices.api'
import { DEVICES_KEY } from '@/components/devices/DeviceDialogs'
import { RegisterTab } from '@/components/devices/DeviceRegister'
import { FootageTab, IssuesTab, RunbooksTab, VerifyTab } from '@/components/devices/DeviceQueues'
import { AccessTab, AccessoriesTab, AccountsTab, GuidesTab, SettingsTab } from '@/components/devices/DeviceAdmin'

const TABS = [
  { key: 'register', label: 'Devices' },
  { key: 'verify', label: 'To verify' },
  { key: 'issues', label: 'Issues' },
  { key: 'runbooks', label: 'Lost & revoked' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'access', label: 'Access & revoke' },
  { key: 'footage', label: 'Shoot uploads' },
  { key: 'settings', label: 'Settings' },
  { key: 'guides', label: 'Guides' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function DevicesPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'register') as TabKey
  const { data: summary } = useQuery({ queryKey: [...DEVICES_KEY, 'summary'], queryFn: devicesApi.summary })
  const counts: Partial<Record<TabKey, number>> = {
    verify: summary?.checksToVerify,
    issues: summary?.openIssues,
    runbooks: summary?.openRunbooks,
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="Devices"
        description="Every company phone and laptop — who has it, its condition, the monthly checks, the accounts on it, and what to do when one goes missing."
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams(t.key === 'register' ? {} : { tab: t.key }, { replace: true })}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {Boolean(counts[t.key]) && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary tabular-nums">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'register' && <RegisterTab summary={summary} />}
      {tab === 'verify' && <VerifyTab />}
      {tab === 'issues' && <IssuesTab />}
      {tab === 'runbooks' && <RunbooksTab />}
      {tab === 'accessories' && <AccessoriesTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'footage' && <FootageTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'guides' && <GuidesTab />}
    </div>
  )
}
