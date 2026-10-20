import { apiClient } from './client'

// The Action centre's "Acknowledge" — what this person has acknowledged, by
// key (see lib/actionKeys.ts). Kept on the server, so it holds on every device.

export async function getActionAcks() {
  const { data } = await apiClient.get<{ keys: string[] }>('/action-centre/acks')
  return data.keys
}

export async function acknowledgeActions(keys: string[]) {
  await apiClient.post('/action-centre/acks', { keys })
}

export async function restoreActions(keys: string[]) {
  await apiClient.delete('/action-centre/acks', { data: { keys } })
}
