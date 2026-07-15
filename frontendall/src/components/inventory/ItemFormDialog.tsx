import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useInventoryCategories, useCreateItem, useUpdateItem } from '@/hooks/useInventory'
import type { InventoryItem } from '@/api/inventory.api'

const NEW_CATEGORY = '__new__'

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem
}) {
  const { data: categories } = useInventoryCategories()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem(item?._id ?? '')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [totalQuantity, setTotalQuantity] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [photo, setPhoto] = useState<File | undefined>()

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setDescription(item?.description ?? '')
    setTotalQuantity(String(item?.totalQuantity ?? 1))
    setCategoryId(item?.category?._id ?? '')
    setNewCategoryName('')
    setPhoto(undefined)
  }, [open, item])

  const isEdit = Boolean(item)
  const isPending = createItem.isPending || updateItem.isPending

  const onSubmit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (categoryId === NEW_CATEGORY && !newCategoryName.trim()) {
      toast.error('Type a name for the new topic')
      return
    }
    const qty = Number(totalQuantity)
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error('Total quantity must be a positive whole number')
      return
    }

    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      totalQuantity: qty,
      categoryId: categoryId && categoryId !== NEW_CATEGORY ? categoryId : undefined,
      newCategoryName: categoryId === NEW_CATEGORY ? newCategoryName.trim() : undefined,
    }

    const onSuccess = () => {
      toast.success(isEdit ? 'Item updated' : 'Item added to inventory')
      onOpenChange(false)
    }
    const onError = () => toast.error(isEdit ? 'Could not update item' : 'Could not add item')

    if (isEdit) {
      updateItem.mutate({ input, photo }, { onSuccess, onError })
    } else {
      createItem.mutate({ input, photo }, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit inventory item' : 'Add inventory item'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sony A7 III" />
          </div>

          <div className="grid gap-1.5">
            <Label>Topic / category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic…" />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY}>+ New topic…</SelectItem>
              </SelectContent>
            </Select>
            {categoryId === NEW_CATEGORY && (
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New topic name"
                className="mt-1"
              />
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid gap-1.5">
            <Label>Total quantity in possession</Label>
            <Input type="number" min={1} value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} className="w-32" />
          </div>

          <div className="grid gap-1.5">
            <Label>Photo</Label>
            <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0])} />
            {item?.photoUrl && !photo && (
              <img src={item.photoUrl} alt={item.name} className="mt-1 h-20 w-20 rounded-lg object-cover" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
