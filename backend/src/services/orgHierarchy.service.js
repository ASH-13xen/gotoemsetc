const OrgNode = require('../models/OrgNode');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { ORG_NODE_KIND, TEAM_MEMBER_ROLE, USER_ROLES, EMPLOYEE_STATUS } = require('../config/constants');
const { hasRole } = require('../utils/roles');

// Who sits where in the Organisation chart, for tickets:
//   - you may raise a ticket for anyone in your own box (whoever shares it),
//     in a box on the same level as yours, or anywhere below it;
//   - a team is a tree of role boxes: Content Manager (the head) → its
//     Social Media Managers → each SMM's own Videographer and Editor. "Same
//     level" means role boxes sharing a parent (the team's SMMs; one SMM's
//     Videographer and Editor), never the head;
//   - CEO and admin may raise for anyone; nobody raises upwards.
// A login role counts as holding the box that gives it (the "hr" login holds
// the HR box). Read fresh on every call — the chart is small and changes
// must apply at once.

const idOf = (v) => (v ? String(v._id || v) : null);

async function loadChart() {
  const nodes = await OrgNode.find({})
    .select('title kind parent assignees grantsRole teamRole isTeamHead workTeam order')
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const byId = new Map(nodes.map((n) => [idOf(n._id), n]));
  const children = new Map();
  for (const n of nodes) {
    const p = idOf(n.parent);
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(n);
  }
  return { nodes, byId, children };
}

const holders = (node) => (node?.assignees || []).map(idOf);
const kids = (chart, node) => chart.children.get(idOf(node._id)) || [];

function descendants(chart, node) {
  const out = [];
  const stack = [...kids(chart, node)];
  while (stack.length) {
    const n = stack.pop();
    out.push(n);
    stack.push(...kids(chart, n));
  }
  return out;
}

// The role boxes on the same level as this one (sharing its parent).
function sameLevel(chart, roleBox) {
  const parent = chart.byId.get(idOf(roleBox.parent));
  if (!parent) return [];
  return kids(chart, parent).filter((n) => n.kind === ORG_NODE_KIND.TEAM_ROLE);
}

// Everyone below a box. A head sitting level with the team's other role
// boxes (the older, flat layout) is still above them.
function belowBox(chart, box) {
  const below = descendants(chart, box).flatMap(holders);
  if (box.kind === ORG_NODE_KIND.TEAM_ROLE && box.isTeamHead) {
    for (const n of sameLevel(chart, box).filter((x) => !x.isTeamHead)) {
      below.push(...holders(n), ...descendants(chart, n).flatMap(holders));
    }
  }
  return below;
}

// Everyone on the same level as a box: whoever shares it, and — for a role
// box that isn't the team head — the other role boxes beside it.
function groupOf(chart, box) {
  if (box.kind === ORG_NODE_KIND.TEAM_ROLE && !box.isTeamHead) {
    return sameLevel(chart, box)
      .filter((n) => !n.isTeamHead)
      .flatMap(holders);
  }
  return holders(box);
}

function heldBoxes(chart, user) {
  const employeeId = idOf(user?.employeeLink);
  return chart.nodes.filter(
    (n) =>
      n.parent && // nobody is placed in the top (Admin) box
      ((employeeId && holders(n).includes(employeeId)) || (n.grantsRole && n.grantsRole === user?.role))
  );
}

const seesEveryone = (user) => hasRole(user, USER_ROLES.ADMIN, USER_ROLES.CEO);

async function activeEmployeeIds(ids) {
  const filter = { status: EMPLOYEE_STATUS.ACTIVE, isDeleted: { $ne: true } };
  if (ids) filter._id = { $in: [...ids] };
  return (await Employee.find(filter).select('_id').lean()).map((e) => idOf(e._id));
}

// Everyone this person may raise a ticket for (active employees only),
// themself included.
async function raisableFor(user, chart) {
  if (seesEveryone(user)) return new Set(await activeEmployeeIds());
  const c = chart || (await loadChart());
  const ids = new Set();
  if (user?.employeeLink) ids.add(idOf(user.employeeLink));
  for (const box of heldBoxes(c, user)) {
    groupOf(c, box).forEach((id) => ids.add(id));
    belowBox(c, box).forEach((id) => ids.add(id));
  }
  return new Set(await activeEmployeeIds(ids));
}

async function canRaiseFor(user, employeeId, chart) {
  return (await raisableFor(user, chart)).has(idOf(employeeId));
}

// ---- teams --------------------------------------------------------------

function teamBoxes(chart) {
  return chart.nodes.filter((n) => n.kind === ORG_NODE_KIND.TEAM);
}

// Role boxes anywhere inside a team.
function roleBoxesOf(chart, teamBoxId) {
  const team = chart.byId.get(idOf(teamBoxId));
  if (!team) return [];
  return descendants(chart, team).filter((n) => n.kind === ORG_NODE_KIND.TEAM_ROLE);
}

function roleHolders(chart, teamBoxId, role) {
  return [...new Set(roleBoxesOf(chart, teamBoxId).filter((n) => n.teamRole === role).flatMap(holders))];
}

function teamHeads(chart, teamBoxId) {
  return [...new Set(roleBoxesOf(chart, teamBoxId).filter((n) => n.isTeamHead).flatMap(holders))];
}

// A team's Social Media Managers, each with the Videographers and Editors
// in the boxes under their own SMM box.
function smmsOf(chart, teamBoxId) {
  const out = new Map();
  for (const box of roleBoxesOf(chart, teamBoxId).filter((n) => n.teamRole === TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER)) {
    const under = descendants(chart, box);
    for (const id of holders(box)) {
      if (!out.has(id)) out.set(id, { employeeId: id, videographers: new Set(), editors: new Set() });
      const e = out.get(id);
      under.filter((n) => n.teamRole === TEAM_MEMBER_ROLE.VIDEOGRAPHER).flatMap(holders).forEach((x) => e.videographers.add(x));
      under.filter((n) => n.teamRole === TEAM_MEMBER_ROLE.EDITOR).flatMap(holders).forEach((x) => e.editors.add(x));
    }
  }
  return [...out.values()].map((e) => ({ employeeId: e.employeeId, videographers: [...e.videographers], editors: [...e.editors] }));
}

function teamMembers(chart, teamBoxId) {
  const team = chart.byId.get(idOf(teamBoxId));
  if (!team) return [];
  return [...new Set([...holders(team), ...descendants(chart, team).flatMap(holders)])];
}

// The team boxes this employee holds a box in.
function teamsOfEmployee(chart, employeeId) {
  const id = idOf(employeeId);
  return teamBoxes(chart).filter((t) => teamMembers(chart, t._id).includes(id));
}

// Every team box with its role boxes (at any depth) and who holds them, and
// each SMM's own Videographers and Editors — for pickers.
function describeTeams(chart) {
  return teamBoxes(chart).map((t) => ({
    _id: idOf(t._id),
    title: t.title,
    workTeam: idOf(t.workTeam),
    roles: roleBoxesOf(chart, t._id).map((n) => ({
      _id: idOf(n._id),
      parent: idOf(n.parent),
      box: n.title,
      role: n.teamRole,
      isHead: Boolean(n.isTeamHead),
      holders: holders(n),
    })),
    smms: smmsOf(chart, t._id),
  }));
}

// Holders of the Team Lead post (by box or by login). `vacant` = nobody is
// placed in the Team Lead box — a generic team_lead login alone doesn't fill it.
async function teamLeads(chart) {
  const fromBoxes = chart.nodes.filter((n) => n.grantsRole === USER_ROLES.TEAM_LEAD).flatMap(holders);
  const logins = await User.find({ role: USER_ROLES.TEAM_LEAD, isActive: true }).select('_id employeeLink').lean();
  return {
    employeeIds: [...new Set([...fromBoxes, ...logins.map((u) => idOf(u.employeeLink)).filter(Boolean)])],
    userIds: logins.map((u) => idOf(u._id)),
    vacant: fromBoxes.length === 0,
  };
}

// Who acts on a Team Lead step: the Team Lead (box or login), plus the CEO
// and admin while the box has nobody in it.
async function leadActors(chart) {
  const leads = await teamLeads(chart);
  if (!leads.vacant) return { employeeIds: leads.employeeIds, userIds: leads.userIds, fallback: null };
  const top = await ceoAndAdmin(chart);
  return {
    employeeIds: [...new Set([...leads.employeeIds, ...top.employeeIds])],
    userIds: [...new Set([...leads.userIds, ...top.userIds])],
    fallback: 'Team Lead',
  };
}

// The CEO (by post or login) and admin — they act on Team Lead steps while
// that box is vacant, and receive submitted tickets.
async function ceoAndAdmin(chart, { includeAdmin = true } = {}) {
  const ceoEmployees = chart.nodes.filter((n) => n.grantsRole === USER_ROLES.CEO).flatMap(holders);
  const roles = includeAdmin ? [USER_ROLES.CEO, USER_ROLES.ADMIN] : [USER_ROLES.CEO];
  const logins = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();
  return { employeeIds: [...new Set(ceoEmployees)], userIds: logins.map((u) => idOf(u._id)) };
}

module.exports = {
  loadChart,
  raisableFor,
  canRaiseFor,
  seesEveryone,
  teamBoxes,
  roleHolders,
  teamHeads,
  smmsOf,
  teamMembers,
  teamsOfEmployee,
  describeTeams,
  teamLeads,
  leadActors,
  ceoAndAdmin,
  idOf,
  TEAM_ROLE: TEAM_MEMBER_ROLE,
};
