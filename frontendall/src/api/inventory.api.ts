import { apiClient } from './client'

export interface InventoryCategory {
  _id: string
  name: string
}

export interface EmployeeRef {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface InventoryItem {
  _id: string
  name: string
  category: InventoryCategory
  description?: string
  photoUrl?: string
  totalQuantity: number
  lockedQuantity: number
  availableQuantity: number
}

export type BookingContext = 'event' | 'client_task' | 'other'
export type BookingStatus = 'active' | 'released'
export type ReleasedByRole = 'employee' | 'admin'

export interface InventoryBooking {
  _id: string
  item: string | { _id: string; name: string; photoUrl?: string }
  quantity: number
  bookedBy?: EmployeeRef | null
  startDate: string
  endDate: string
  context: BookingContext
  event?: { _id: string; title: string } | null
  clientTask?: {
    _id: string
    itemLabel: string
    sectionName: string
    client?: { _id: string; clientName: string; brandName: string } | null
  } | null
  notes?: string
  status: BookingStatus
  releasedAt?: string
  releasedBy?: EmployeeRef | null
  releasedByRole?: ReleasedByRole
  releasedEarly?: boolean
  createdAt: string
}

export async function listCategories(): Promise<InventoryCategory[]> {
  const { data } = await apiClient.get('/inventory/categories')
  return data.categories
}

export async function listItems(): Promise<InventoryItem[]> {
  const { data } = await apiClient.get('/inventory/items')
  return data.items
}

export async function getItem(id: string): Promise<{ item: InventoryItem; activeBookings: InventoryBooking[] }> {
  const { data } = await apiClient.get(`/inventory/items/${id}`)
  return data
}

export interface ItemFormInput {
  name: string
  description?: string
  totalQuantity: number
  categoryId?: string
  newCategoryName?: string
}

export async function createItem(input: ItemFormInput, photo?: File): Promise<InventoryItem> {
  const form = new FormData()
  form.append('name', input.name)
  if (input.description) form.append('description', input.description)
  form.append('totalQuantity', String(input.totalQuantity))
  if (input.categoryId) form.append('categoryId', input.categoryId)
  if (input.newCategoryName) form.append('newCategoryName', input.newCategoryName)
  if (photo) form.append('photo', photo)
  const { data } = await apiClient.post('/inventory/items', form)
  return data.item
}

export async function updateItem(id: string, input: Partial<ItemFormInput>, photo?: File): Promise<InventoryItem> {
  const form = new FormData()
  if (input.name !== undefined) form.append('name', input.name)
  if (input.description !== undefined) form.append('description', input.description)
  if (input.totalQuantity !== undefined) form.append('totalQuantity', String(input.totalQuantity))
  if (input.categoryId) form.append('categoryId', input.categoryId)
  if (input.newCategoryName) form.append('newCategoryName', input.newCategoryName)
  if (photo) form.append('photo', photo)
  const { data } = await apiClient.patch(`/inventory/items/${id}`, form)
  return data.item
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/inventory/items/${id}`)
}

export interface BookingFormInput {
  quantity: number
  startDate: string
  endDate: string
  context: BookingContext
  event?: string
  clientTask?: string
  notes?: string
}

export async function createBooking(itemId: string, input: BookingFormInput): Promise<InventoryBooking> {
  const { data } = await apiClient.post(`/inventory/items/${itemId}/bookings`, input)
  return data.booking
}

export async function listBookingsForItem(itemId: string): Promise<InventoryBooking[]> {
  const { data } = await apiClient.get(`/inventory/items/${itemId}/bookings`)
  return data.bookings
}

export async function listMyBookings(): Promise<InventoryBooking[]> {
  const { data } = await apiClient.get('/inventory/my-bookings')
  return data.bookings
}

export async function releaseBooking(bookingId: string): Promise<InventoryBooking> {
  const { data } = await apiClient.post(`/inventory/bookings/${bookingId}/release`)
  return data.booking
}
