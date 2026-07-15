import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as inventoryApi from '@/api/inventory.api'
import type { BookingFormInput, ItemFormInput } from '@/api/inventory.api'

const ITEMS_KEY = ['inventory', 'items']
const CATEGORIES_KEY = ['inventory', 'categories']
const MY_BOOKINGS_KEY = ['inventory', 'my-bookings']

export function useInventoryCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: inventoryApi.listCategories })
}

export function useInventoryItems() {
  return useQuery({ queryKey: ITEMS_KEY, queryFn: inventoryApi.listItems })
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ['inventory', 'items', id],
    queryFn: () => inventoryApi.getItem(id as string),
    enabled: Boolean(id),
  })
}

export function useItemBookings(itemId: string | undefined) {
  return useQuery({
    queryKey: ['inventory', 'items', itemId, 'bookings'],
    queryFn: () => inventoryApi.listBookingsForItem(itemId as string),
    enabled: Boolean(itemId),
  })
}

export function useMyBookings() {
  return useQuery({ queryKey: MY_BOOKINGS_KEY, queryFn: inventoryApi.listMyBookings })
}

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, photo }: { input: ItemFormInput; photo?: File }) => inventoryApi.createItem(input, photo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
    },
  })
}

export function useUpdateItem(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, photo }: { input: Partial<ItemFormInput>; photo?: File }) => inventoryApi.updateItem(itemId, input, photo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items', itemId] })
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => inventoryApi.deleteItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })
}

export function useCreateBooking(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BookingFormInput) => inventoryApi.createBooking(itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'items', itemId] })
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY })
    },
  })
}

export function useReleaseBooking(itemId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) => inventoryApi.releaseBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      if (itemId) queryClient.invalidateQueries({ queryKey: ['inventory', 'items', itemId] })
      queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY })
    },
  })
}
