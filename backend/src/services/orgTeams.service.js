const OrgNode = require('../models/OrgNode');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE, EMPLOYEE_STATUS } = require('../config/constants');

// Who is on which team, read straight from the Organisation chart: someone
// is on a team when they hold one of the role boxes inside that team's box
// (Content Manager, Social Media Manager, Videographer, …, at any depth), and
// that team's content managers are whoever holds a Content Manager box
// there. Leave applications and overtime go to these content managers first
// — anyone in no team box goes straight to HR. The old Task Management team
// lists are not consulted.

const idOf = (value) => (value ? String(value._id || value) : null);

// Every team box with its members and content managers. A role box can sit
// directly under its team or deeper (Content Manager → SMM → Videographer),
// so each one is traced up to its team.
async function allTeams() {
  const nodes = await OrgNode.find({ kind: { $in: [ORG_NODE_KIND.TEAM, ORG_NODE_KIND.TEAM_ROLE] } })
    .select('kind parent teamRole assignees')
    .lean();
  const byId = new Map(nodes.map((n) => [idOf(n._id), n]));
  const teamOf = (box) => {
    let current = byId.get(idOf(box.parent));
    while (current && current.kind === ORG_NODE_KIND.TEAM_ROLE) current = byId.get(idOf(current.parent));
    return current?.kind === ORG_NODE_KIND.TEAM ? idOf(current._id) : null;
  };
  const roleBoxes = nodes.filter((n) => n.kind === ORG_NODE_KIND.TEAM_ROLE);
  const teams = new Map();
  for (const box of roleBoxes) {
    const teamId = teamOf(box);
    if (!teamId) continue;
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

// Of these employees, the ones who can actually act: still active, with an
// active login. Someone who has left (or has no login) never holds up a
// request — it moves on to HR instead.
async function ableToAct(employeeIds) {
  if (!employeeIds.length) return [];
  const [employees, users] = await Promise.all([
    Employee.find({ _id: { $in: employeeIds }, status: EMPLOYEE_STATUS.ACTIVE, isDeleted: { $ne: true } }).select('_id').lean(),
    User.find({ employeeLink: { $in: employeeIds }, isActive: true }).select('employeeLink').lean(),
  ]);
  const active = new Set(employees.map((e) => idOf(e._id)));
  const withLogin = new Set(users.map((u) => idOf(u.employeeLink)));
  return employeeIds.filter((id) => active.has(id) && withLogin.has(id));
}

// Who reviews this employee's leave, modification requests and overtime
// before HR: the content managers of their teams who can act. Empty (so
// straight to HR) when they are on no team, are a content manager themself,
// or their teams have no content manager who can act.
async function contentManagersFor(employeeId) {
  const id = idOf(employeeId);
  const teams = await teamsOf(id);
  if (teams.some((t) => t.contentManagers.has(id))) return [];
  return ableToAct([...new Set(teams.flatMap((t) => [...t.contentManagers]))]);
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
