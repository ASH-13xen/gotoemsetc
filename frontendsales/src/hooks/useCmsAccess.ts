import { useAuth } from '@/hooks/useAuth'
import type { CalendarItem, TeamRef, TeamMemberRole } from '@/api/cms.api'

// UI mirror of the backend's utils/cmsAccess.js. It exists to hide controls
// the user can't use, not to enforce anything — every one of these rules is
// checked again server-side, and this copy is deliberately the permissive
// side of any disagreement (showing a button that 403s is a worse bug than
// hiding one, but far less dangerous than the reverse).
//
// canAct() below is intentionally a looser mirror than the backend's
// step-by-step actor resolution (config/cmsPipelines.js) — it shows the
// action controls to anyone plausibly involved (admin/Digital Admin, the
// global Team Leader, or anyone on the team), and lets the server's
// canActOnCurrentStep be the real authority. Porting the full per-step actor
// table client-side would only buy hiding a control from a teammate who
// isn't up right now — the server 403s them with a clear message either way.
export function useCmsAccess() {
  const { user } = useAuth()
  const employeeId = user?.employeeLink ?? null

  // Closes the gap the backend's isCmsAdmin() comment used to flag.
  const isCmsAdmin = user?.role === 'admin' || user?.role === 'digital_admin'
  const isHr = user?.role === 'hr'
  // The company-wide Team Leader — the team_lead login role, not tied to any
  // one team. Distinct from a WorkTeam's own "Team Main" (isLeaderOf below).
  const isGlobalTeamLead = user?.role === 'team_lead'

  const idOf = (v: unknown): string | null => {
    if (!v) return null
    if (typeof v === 'string') return v
    return (v as { _id?: string })._id ?? null
  }

  // Team Main — the per-team `leader` field, kept under its old name and its
  // existing local scheduling authority.
  const isLeaderOf = (team?: TeamRef | null) => Boolean(employeeId) && idOf(team?.leader) === employeeId

  const hasTeamRole = (team: TeamRef | null | undefined, role: TeamMemberRole) =>
    Boolean(employeeId) && (team?.memberRoles ?? []).some((r) => idOf(r.employee) === employeeId && r.roles.includes(role))

  const isSmmOf = (team?: TeamRef | null) => hasTeamRole(team, 'social_media_manager')

  const isOnTeam = (team?: TeamRef | null) => {
    if (!employeeId || !team) return false
    if (idOf(team.leader) === employeeId) return true
    return (team.members ?? []).some((m) => idOf(m) === employeeId)
  }

  return {
    isCmsAdmin,
    isGlobalTeamLead,
    // HR sees everything and changes nothing.
    isReadOnly: isHr,
    canEditClient: isCmsAdmin,
    canManageCalendar: isCmsAdmin,
    canSchedule: (team?: TeamRef | null) => isCmsAdmin || isLeaderOf(team),
    canReassign: (team?: TeamRef | null) => isCmsAdmin || isLeaderOf(team),
    isLeaderOf,
    isSmmOf,
    hasTeamRole,

    // Whether this user is plausibly the one being waited on right now —
    // see the file-level note on why this is a loose mirror.
    canAct: (item: CalendarItem, team?: TeamRef | null) => {
      if (item.isRejected) return false
      if (isCmsAdmin || isGlobalTeamLead) return true
      return isOnTeam(team)
    },
  }
}
