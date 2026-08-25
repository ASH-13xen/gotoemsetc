import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as announcementsApi from '@/api/announcements.api'
import type { CreateAnnouncementInput } from '@/api/announcements.api'

const LIST_KEY = ['announcements']
const PENDING_KEY = ['announcements', 'mine-pending']

export function useAnnouncements() {
  return useQuery({ queryKey: LIST_KEY, queryFn: () => announcementsApi.listAnnouncements() })
}

export function useMyPendingAnnouncements() {
  return useQuery({ queryKey: PENDING_KEY, queryFn: () => announcementsApi.listMyPendingAnnouncements() })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementsApi.createAnnouncement(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  })
}

export function useAcknowledgeAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => announcementsApi.acknowledgeAnnouncement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  })
}
