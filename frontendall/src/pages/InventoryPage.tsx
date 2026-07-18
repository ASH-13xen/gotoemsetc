import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useInventoryItems } from '@/hooks/useInventory'
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog'

export default function InventoryPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'hr'
  const { data: items, isLoading } = useInventoryItems()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Equipment in the company's possession, and who has what locked out.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add item
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-12 text-center">
          <Package className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No inventory items yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item._id} to={`/inventory/${item._id}`}>
              <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
                <div className="flex h-32 items-center justify-center bg-secondary/30">
                  {item.photoUrl ? (
                    <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="size-10 text-muted-foreground/40" />
                  )}
                </div>
                <CardContent className="grid gap-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.category?.name}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.availableQuantity} / {item.totalQuantity} available
                    </span>
                    {item.lockedQuantity > 0 && <Badge variant="warning">{item.lockedQuantity} locked</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ItemFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
