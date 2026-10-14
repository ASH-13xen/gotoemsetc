const OrgNode = require('../models/OrgNode');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE } = require('../config/constants');

// Who is on which team, read straight from the Organisation chart: someone
// is on a team when they hold one of the role boxes directly under that
// team's box (Content Manager, Social Media Manager, Videographer, …), and
// that team's content managers are whoever holds a Content Manager box
// there. Leave applications and overtime go to these content managers first
// — anyone in no team box goes straight to HR. The old Task Management team
// lists are not consulted.

const idOf = (value) => (value ? String(value._id || value) : null);

// Every team box with its members and content managers.
async function allTeams() {
  const roleBoxes = await OrgNode.find({ kind: ORG_NODE_KIND.TEAM_ROLE }).select('parent teamRole assignees').lean();
  const teamIds = new Set(
    (await OrgNode.find({ kind: ORG_NODE_KIND.TEAM }).select('_id').lean()).map((n) => idOf(n._id))
  );
  const teams = new Map();
  for (const box of roleBoxes) {
    const teamId = idOf(box.parent);
    if (!teamIds.has(teamId)) continue;
    if (!teams.has(teamId)) teams.set(teamId, { members: new Set(), contentManagers: new Set() });
    const team = teams.get(teamId);
    for (const employeeId of (box.assignees || []).map(idOf)) {
      team.members.add(employeeId);
      if (box.teamRole === TEAM_MEMBER_ROLE.CONTENT_MANAGER) team.contentManagers.add(employeeId);
    }
  }
  return [...teams.values()];
}

// The teams this employee is on.
async function teamsOf(employeeId) {
  const id = idOf(employeeId);
  return (await allTeams()).filter((t) => t.members.has(id));
}

// Who reviews this employee's leave/overtime before HR: the content managers
// of their teams. Empty (so straight to HR) when they are on no team, are a
// content manager themself, or their teams have no content manager.
async function contentManagersFor(employeeId) {
  const id = idOf(employeeId);
  const teams = await teamsOf(id);
  if (teams.some((t) => t.contentManagers.has(id))) return [];
  return [...new Set(teams.flatMap((t) => [...t.contentManagers]))];
}

async function isContentManagerOf(applicantEmployeeId, cmEmployeeId) {
  if (!cmEmployeeId) return false;
  return (await contentManagersFor(applicantEmployeeId)).includes(idOf(cmEmployeeId));
}

// Everyone whose requests this content manager reviews (themself excluded).
// Empty when they hold no Content Manager box.
async function reviewedBy(cmEmployeeId) {
  const id = idOf(cmEmployeeId);
  const teams = (await allTeams()).filter((t) => t.contentManagers.has(id));
  const ids = new Set(teams.flatMap((t) => [...t.members]));
  ids.delete(id);
  return { isContentManager: teams.length > 0, employeeIds: [...ids] };
}

module.exports = { teamsOf, contentManagersFor, isContentManagerOf, reviewedBy };
