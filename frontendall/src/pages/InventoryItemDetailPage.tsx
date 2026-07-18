import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Lock, Package, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useDeleteItem, useInventoryItem, useItemBookings } from '@/hooks/useInventory'
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog'
import { BookingDialog } from '@/components/inventory/BookingDialog'
import { BookingRow } from '@/components/inventory/BookingRow'

export default function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'hr'

  const { data, isLoading } = useInventoryItem(id)
  const { data: bookings } = useItemBookings(id)
  const deleteItem = useDeleteItem()
  const [editOpen, setEditOpen] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const { item } = data

  const onDelete = () => {
    if (!id) return
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return
    deleteItem.mutate(id, {
      onSuccess: () => {
        toast.success('Item deleted')
        navigate('/inventory')
      },
      onError: (err) => {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(message || 'Could not delete this item')
      },
    })
  }

  return (
    <div className="space-y-6 py-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/inventory')}>
        <ArrowLeft className="size-3.5" />
        Back to inventory
      </Button>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="grid gap-3">
          <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-secondary/30">
            {item.photoUrl ? (
              <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="size-12 text-muted-foreground/40" />
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete} disabled={deleteItem.isPending}>
                {deleteItem.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{item.name}</h1>
              <Badge variant="outline">{item.category?.name}</Badge>
            </div>
            {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-2xl font-black">{item.availableQuantity}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Available now</p>
            </div>
            <div className="text-muted-foreground">/</div>
            <div>
              <p className="text-2xl font-black">{item.totalQuantity}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total owned</p>
            </div>
            <Button className="ml-auto" onClick={() => setBookOpen(true)} disabled={item.availableQuantity === 0}>
              <Lock className="size-4" />
              Book this item
            </Button>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bookings</p>
            {!bookings || bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              bookings.map((b) => <BookingRow key={b._id} booking={b} itemId={item._id} />)
            )}
          </div>
        </div>
      </div>

      <ItemFormDialog open={editOpen} onOpenChange={setEditOpen} item={item} />
      <BookingDialog open={bookOpen} onOpenChange={setBookOpen} item={item} />
    </div>
  )
}
