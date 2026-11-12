import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Smartphone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import { deviceActionItems, type DeviceActionItems } from '@/api/devices.api'
import { AckButton, useAckScope } from '@/components/layout/ActionAck'
import { ACTION_KEY } from '@/lib/actionKeys'

export const DEVICE_ITEMS_KEY = ['device-action-items']

// What the device register needs from HR: monthly checks to verify, problems
// reported, lost phones and revoked access still being worked through, a
// device still with someone who has left — decisions — and checks not sent
// or agreements not signed — notices.
const SECTIONS: { key: keyof DeviceActionItems; title: string; tab: string; notice: boolean }[] = [
  { key: 'unreturned', title: 'Still with someone who has left', tab: '', notice: false },
  { key: 'runbooks', title: 'Lost devices and revoked access', tab: 'runbooks', notice: false },
  { key: 'checksToVerify', title: 'Monthly checks to verify', tab: 'verify', notice: false },
  { key: 'issues', title: 'Problems reported', tab: 'issues', notice: false },
  { key: 'checksOverdue', title: "This month's check not sent", tab: '', notice: true },
  { key: 'unsigned', title: 'Handover agreement not signed', tab: '', notice: true },
]

export const deviceItemKey = (section: keyof DeviceActionItems, id: string) => ACTION_KEY.device(section, id)

export function useDeviceActionItems() {
  const { user } = useAuth()
  const hr = can(user, 'hrms')
  return useQuery({ queryKey: DEVICE_ITEMS_KEY, queryFn: deviceActionItems, enabled: hr, refetchInterval: 120_000 })
}

export function DevicesActionCard() {
  const { user } = useAuth()
  const hr = can(user, 'hrms')
  const { data } = useDeviceActionItems()
  const { shows, notices } = useAckScope()
  if (!hr || !data) return null
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: (s.notice && !notices ? [] : data[s.key]).filter((i) => shows(deviceItemKey(s.key, i.id))),
  })).filter((s) => s.items.length)
  if (!sections.length) return null
  const total = sections.reduce((t, s) => t + s.items.length, 0)

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-violet-500/30 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-violet-500/[0.06] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow">
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Company devices</p>
          <p className="text-xs text-muted-foreground">Checks, problems, lost phones and revoked access — handled in HR Work → Devices.</p>
        </div>
        <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-black text-white">{total}</span>
      </div>
      <div className="grid gap-3 p-4">
        {sections.map((s) => (
          <div key={s.key} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-muted-foreground">{s.title}</p>
              <Link to={`/hr/devices${s.tab ? `?tab=${s.tab}` : ''}`} className="text-xs font-semibold text-primary hover:underline">
                Open
              </Link>
            </div>
            {s.items.map((i) => (
              <div key={i.id} className="flex items-start gap-2 rounded-xl bg-violet-500/[0.07] p-2.5 text-sm text-foreground">
                <span className="min-w-0 flex-1">{i.text}</span>
                <AckButton keys={[deviceItemKey(s.key, i.id)]} notice={s.notice} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
