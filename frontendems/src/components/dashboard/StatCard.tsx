import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  label: string
  value: number | undefined
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border/10 shadow-diffuse hover:-translate-y-0.5 transition-all duration-300">
      <CardContent className="flex flex-col justify-between p-0">
        <div className="flex flex-col">
          {value === undefined ? (
            <Skeleton className="h-16 w-20 bg-secondary/40 rounded-xl" />
          ) : (
            <p className="text-6xl font-extrabold leading-none tracking-tighter text-foreground">
              {value}
            </p>
          )}
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
