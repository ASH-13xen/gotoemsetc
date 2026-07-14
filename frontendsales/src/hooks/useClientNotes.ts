import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as clientNotesApi from '@/api/clientNotes.api'

export function useClientNotes(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: () => clientNotesApi.listNotes(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useAddClientNote(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => clientNotesApi.addNote(clientId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] })
      queryClient.invalidateQueries({ queryKey: ['activity', clientId] })
    },
  })
}

export function useDeleteClientNote(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => clientNotesApi.deleteNote(clientId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] }),
  })
}
