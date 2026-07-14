import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as stepLibraryApi from '@/api/stepLibrary.api'

const KEY = ['step-library']

export function useStepLibrary() {
  return useQuery({ queryKey: KEY, queryFn: stepLibraryApi.listSteps })
}

export function useCreateStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => stepLibraryApi.createStep(label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => stepLibraryApi.updateStep(id, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteStep() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => stepLibraryApi.deleteStep(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
