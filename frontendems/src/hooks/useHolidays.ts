import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as holidaysApi from '@/api/holidays.api'

export function useHolidays(month: number, year: number) {
  return useQuery({
    queryKey: ['holidays', month, year],
    queryFn: () => holidaysApi.listHolidays(month, year),
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, label }: { date: string; label: string }) => holidaysApi.createHoliday(date, label),
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
