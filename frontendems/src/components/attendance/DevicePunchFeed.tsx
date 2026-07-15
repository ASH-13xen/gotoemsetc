import { Fingerprint } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDevicePunches } from '@/hooks/useDevicePunches'

// Raw feed of whatever the biometric device has pushed — newest first. Not
// wired into the daily attendance mark/status; this is just "show me the
// scans the device sent" for now.
export function DevicePunchFeed() {
  const { data, isLoading } = useDevicePunches({ limit: 20 })
  const punches = data?.punches ?? []

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4 text-primary" />
          <CardTitle>Biometric device scans</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : punches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scans received yet — once your ZKTeco device is configured to push to this server, scans will
            appear here.
          </p>
        ) : (
          <div className="divide-y divide-border/10">
            {punches.map((punch) => (
              <div key={punch._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-foreground">
                  {punch.employee ? `${punch.employee.firstName} ${punch.employee.lastName ?? ''}` : (
                    <span className="text-muted-foreground">
                      Unmatched device ID "{punch.employeeCode}"
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(punch.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
