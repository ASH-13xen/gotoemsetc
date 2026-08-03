import { useQuery } from '@tanstack/react-query'
import * as attendanceWarningsApi from '@/api/attendanceWarnings.api'

export function usePendingWarnings() {
  return useQuery({
    queryKey: ['attendance-warnings-pending'],
    queryFn: () => attendanceWarningsApi.getPendingWarnings(),
  })
}
