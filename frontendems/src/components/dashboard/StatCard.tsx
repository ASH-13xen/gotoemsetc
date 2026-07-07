import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  label: string
  value: number | undefined
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="border-2 border-foreground bg-black p-6">
      <CardContent className="flex flex-col justify-between p-0">
        <div className="flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-16 w-20 bg-neutral-800" />
          ) : (
            <p className="text-6xl font-black leading-none tracking-tighter text-white">
              {value}
            </p>
          )}
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
