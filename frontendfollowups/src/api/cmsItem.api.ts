import { apiClient } from './client'

// A minimal, read-only view of a Client Management System calendar item —
// just enough to show the pipeline stepper and colour chip on a client
// task's detail page here in Task Management. The full CalendarItem shape
// (scheduling, briefs, mutations) belongs to frontendsales; this app only
// ever reads GET /cms/items/:id.
export interface StepTrailEntry {
  key: string
  terminal: boolean
  color: string
  reached: boolean
  current: boolean
}

export interface CmsItemView {
  _id: string
  label: string
  color: string
  trail: StepTrailEntry[]
  isSentBack: boolean
  isRejected: boolean
}

export async function getCmsItem(id: string): Promise<CmsItemView> {
  const { data } = await apiClient.get(`/cms/items/${id}`)
  return data.item
}
