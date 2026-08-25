import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as holidaysApi from '@/api/holidays.api'
import type { HolidayType } from '@/api/holidays.api'

export function useHolidays(month: number, year: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['holidays', month, year],
    queryFn: () => holidaysApi.listHolidays(month, year),
    enabled: options?.enabled ?? true,
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, label, type }: { date: string; label: string; type?: HolidayType }) =>
      holidaysApi.createHoliday(date, label, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => holidaysApi.deleteHoliday(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  })
}
