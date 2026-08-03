import { useAuth } from '@/hooks/useAuth'
import { useWorkTeams } from '@/hooks/useWorkTeams'
import type { WorkTeam } from '@/api/workTeams.api'

// Teams the current user leads — drives the team-leader task-creation
// affordances (New Task visibility, allowed types/team/assignee options in
// CreateTaskDialog) that mirror backend/src/middlewares/taskAccess.middleware.js#requireCanCreateTopLevelTask.
export function useLedTeams(): WorkTeam[] {
  const { user } = useAuth()
  const { data } = useWorkTeams()
  const teams = data?.teams ?? []
  if (!user?.employeeLink) return []
  return teams.filter((t) => t.leader._id === user.employeeLink)
}
