import { useQuery } from '@tanstack/react-query'
import * as birthdaysApi from '@/api/birthdays.api'

export function useBirthdays() {
  return useQuery({
    queryKey: ['birthdays'],
    queryFn: () => birthdaysApi.getBirthdays(),
    staleTime: 5 * 60_000,
  })
}
