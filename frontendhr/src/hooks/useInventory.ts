import { useQuery } from '@tanstack/react-query'
import * as inventoryApi from '@/api/inventory.api'

export function useInventoryReport() {
  return useQuery({
    queryKey: ['inventory-report'],
    queryFn: () => inventoryApi.listInventoryReport(),
  })
}
