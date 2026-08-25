import { useQuery } from '@tanstack/react-query'
import { getCmsItem } from '@/api/cmsItem.api'

// Only fetched for client-type tasks (task.cmsItem set) — powers the
// pipeline stepper and colour chip on the task detail page.
export function useCmsItem(cmsItemId: string | null | undefined) {
  return useQuery({
    queryKey: ['cms-item', cmsItemId],
    queryFn: () => getCmsItem(cmsItemId as string),
    enabled: Boolean(cmsItemId),
    staleTime: 15_000,
  })
}
