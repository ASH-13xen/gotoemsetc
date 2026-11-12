import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CloudUpload, ExternalLink, Palette, Smartphone } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { BrandDialog, CheckDialog, DeviceRow, FootageDialog, HelpDialog, IssueDialog, KEY } from '@/components/devices/MyDevicesCard'
import { deviceName, myDevices, type MyDevice } from '@/api/devices.api'

// Everyone's own page for company devices: what is with them (and what each
// needs now), and the shoot uploads they log or were credited with. Someone
// with no company device can still log an upload shot on another phone.

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const name = (p?: { firstName: string; lastName?: string } | null) => (p ? `${p.firstName} ${p.lastName ?? ''}`.trim() : '—')

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm break-words text-foreground">{value}</p>
    </div>
  )
}

function DeviceFacts({ device }: { device: MyDevice }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Fact label="Model number" value={device.modelNumber} />
      <Fact label="OS" value={[device.os === 'ios' ? 'iOS' : device.os === 'android' ? 'Android' : device.os, device.osVersion].filter(Boolean).join(' ')} />
      <Fact label="Colour" value={device.color} />
      <Fact label="Capacity" value={device.storageGb ? `${device.storageGb} GB` : null} />
      <Fact label="IMEI" value={[device.imei1, device.imei2].filter(Boolean).join(' / ')} />
      <Fact label="Serial number" value={device.serialNumber} />
      <Fact label="SIM" value={[device.simProvider, device.simNumber].filter(Boolean).join(' · ')} />
      <Fact label="With you since" value={device.assignment ? fmt(device.assignment.assignedAt) : null} />
    </div>
  )
}

export default function MyDevicesPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: myDevices, enabled: Boolean(user?.employeeLink) })
  const [dialog, setDialog] = useState<{ kind: 'check' | 'issue'; device: MyDevice } | { kind: 'footage' | 'brand' | 'help' } | null>(null)
  const devices = data?.devices ?? []
  const phones = devices.filter((d) => d.kind === 'phone' || d.kind === 'tablet')

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-8">
      <PageHeader
        title="My devices"
        description="The company devices with you, their monthly check, and the shoot uploads you log."
        actions={
          <>
            {phones.length > 0 && (
              <Button variant="outline" onClick={() => setDialog({ kind: 'brand' })}>
                <Palette className="size-4" /> Brand kit
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog({ kind: 'help' })}>
              <BookOpen className="size-4" /> Help
            </Button>
          </>
        }
      />

      {!user?.employeeLink ? (
        <p className="text-sm text-muted-foreground">This login isn't linked to an employee, so it has no devices.</p>
      ) : isLoading || !data ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <>
          <section className="grid gap-3">
            <h2 className="text-sm font-bold text-foreground">With you</h2>
            {!devices.length ? (
              <Card className="flex flex-row items-center gap-3 p-5 text-sm text-muted-foreground">
                <Smartphone className="size-5" /> No company device is with you right now.
              </Card>
            ) : (
              devices.map((d) => (
                <Card key={d._id} className="grid gap-4 p-5">
                  <DeviceRow device={d} data={data} onCheck={() => setDialog({ kind: 'check', device: d })} onIssue={() => setDialog({ kind: 'issue', device: d })} />
                  <DeviceFacts device={d} />
                </Card>
              ))
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">Shoot uploads</h2>
                <p className="text-xs text-muted-foreground">
                  Upload the footage to the company Google Drive, then log it here. HR opens the link and verifies it.
                </p>
              </div>
              <Button onClick={() => setDialog({ kind: 'footage' })}>
                <CloudUpload className="size-4" /> Log a shoot upload
              </Button>
            </div>
            {!data.footage.length ? (
              <Card className="p-5 text-sm text-muted-foreground">Nothing logged yet.</Card>
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-normal">Logged</th>
                      <th className="px-2 font-normal">Shoot</th>
                      <th className="px-2 font-normal">Uploaded by</th>
                      <th className="px-2 font-normal">Drive</th>
                      <th className="px-4 font-normal">HR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.footage.map((u) => (
                      <tr key={u._id} className="border-b border-border/60 align-top last:border-0">
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {fmtTime(u.createdAt)}
                          <p className="text-muted-foreground">by {name(u.employee)}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p>{u.client?.name ?? u.clientName ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.shootDate ? `Shot ${fmt(u.shootDate)}` : 'Shoot date not given'}
                            {u.device ? ` · ${u.device.code} ${deviceName(u.device)}` : ''}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">{name(u.uploadedBy ?? u.employee)}</td>
                        <td className="px-2 py-2.5">
                          <p className="text-xs">{u.driveAccount?.identifier ?? u.driveName ?? '—'}</p>
                          <a href={u.driveLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            Open <ExternalLink className="size-3" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {u.verifiedAt ? (
                            <>
                              <Badge variant="success">Verified</Badge>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(u.verifiedAt)}</p>
                            </>
                          ) : (
                            <Badge variant="warning">Waiting for HR</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </>
      )}

      {data && dialog?.kind === 'check' && <CheckDialog device={dialog.device} apps={data.apps} locationAccount={data.locationAccount} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'issue' && <IssueDialog device={dialog.device} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'footage' && <FootageDialog devices={devices} onClose={() => setDialog(null)} />}
      {data && dialog?.kind === 'brand' && <BrandDialog brand={data.brand} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
