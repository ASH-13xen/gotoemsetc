import { useQuery } from '@tanstack/react-query'
import * as monthlyBillsApi from '@/api/monthlyBills.api'

export function usePendingBillReminders() {
  return useQuery({
    queryKey: ['monthly-bill-reminders-pending'],
    queryFn: () => monthlyBillsApi.getPendingBillReminders(),
  })
}
