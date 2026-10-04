const ApiError = require('../utils/ApiError');
const OrgNode = require('../models/OrgNode');
const WorkTeam = require('../models/WorkTeam');
const employeeRepository = require('../repositories/employee.repository');
const { ORG_NODE_KIND, EMPLOYEE_STATUS } = require('../config/constants');
const accessService = require('./access.service');

const ASSIGNEE_FIELDS = 'firstName lastName designation employeeCode status';

function idOf(value) {
  return value ? (value._id || value).toString() : null;
}

// The whole chart as a flat list — the client builds the tree from each
// node's `parent`, which keeps every write here a single-node operation.
async function getTree() {
  const nodes = await OrgNode.find()
    .sort({ order: 1, createdAt: 1 })
    .populate('assignees', ASSIGNEE_FIELDS)
    .populate('workTeam', 'name isDeleted')
    .lean();
  return nodes;
}

async function findNodeOrThrow(id) {
  const node = await OrgNode.findById(id);
  if (!node) throw ApiError.notFound('Box not found');
  return node;
}

// Is `candidateId` the node itself or anywhere below it? Moving a node
// under one of its own descendants would cut that branch off into a loop.
async function isSelfOrDescendant(nodeId, candidateId) {
  let current = candidateId ? await OrgNode.findById(candidateId).select('parent') : null;
  while (current) {
    if (idOf(current._id) === idOf(nodeId)) return true;
    current = current.parent ? await OrgNode.findById(current.parent).select('parent') : null;
  }
  return false;
}

async function descendantIds(nodeId) {
  const ids = [];
  let frontier = [nodeId];
  while (frontier.length > 0) {
    // eslint-disable-next-line no-await-in-loop
    const children = await OrgNode.find({ parent: { $in: frontier } }).select('_id');
    frontier = children.map((c) => c._id);
    ids.push(...frontier);
  }
  return ids;
}

// Team roles only make sense directly under a team box (that's how they
// know which WorkTeam to sync to); everything else can sit anywhere.
async function assertValidPlacement({ kind, parentId }) {
  if (!parentId) throw ApiError.badRequest('Choose where this box goes');
  const parent = await OrgNode.findById(parentId).select('kind');
  if (!parent) throw ApiError.badRequest('That parent box no longer exists');
  if (kind === ORG_NODE_KIND.TEAM_ROLE && parent.kind !== ORG_NODE_KIND.TEAM) {
    throw ApiError.badRequest('A team role can only sit directly under a team');
  }
  if (kind !== ORG_NODE_KIND.TEAM_ROLE && parent.kind === ORG_NODE_KIND.TEAM) {
    throw ApiError.badRequest('Only team roles can sit directly under a team');
  }
}

async function assertWorkTeamFree(workTeamId, exceptNodeId) {
  if (!workTeamId) return;
  const team = await WorkTeam.findOne({ _id: workTeamId, isDeleted: false }).select('_id');
  if (!team) throw ApiError.badRequest('That work team no longer exists');
  const taken = await OrgNode.findOne({ workTeam: workTeamId, _id: { $ne: exceptNodeId } }).select('title');
  if (taken) throw ApiError.conflict(`That work team is already linked to "${taken.title}"`);
}

// Mirrors a team box's role boxes onto its linked WorkTeam, so Task
// Management and leave approvals (Content Manager review) follow the chart:
//   - every role type that has a box under this team is set exactly to the
//     employees assigned there (role types with no box are left untouched);
//   - the leader becomes the team head box's first assignee (unchanged if
//     that box is vacant);
//   - everyone assigned is added as a member. Nobody is ever removed from
//     the team's membership here — only their role tags change.
async function syncTeam(teamNodeId) {
  const teamNode = await OrgNode.findById(teamNodeId);
  if (!teamNode || teamNode.kind !== ORG_NODE_KIND.TEAM || !teamNode.workTeam) return;
  const team = await WorkTeam.findOne({ _id: teamNode.workTeam, isDeleted: false });
  if (!team) return;

  const roleNodes = await OrgNode.find({ parent: teamNode._id, kind: ORG_NODE_KIND.TEAM_ROLE });
  const managedRoles = new Set(roleNodes.map((n) => n.teamRole).filter(Boolean));

  const rolesByEmployee = new Map();
  for (const entry of team.memberRoles || []) {
    const kept = (entry.roles || []).filter((role) => !managedRoles.has(role));
    if (kept.length) rolesByEmployee.set(idOf(entry.employee), new Set(kept));
  }
  for (const node of roleNodes) {
    if (!node.teamRole) continue;
    for (const employeeId of node.assignees.map(idOf)) {
      if (!rolesByEmployee.has(employeeId)) rolesByEmployee.set(employeeId, new Set());
      rolesByEmployee.get(employeeId).add(node.teamRole);
    }
  }

  const head = roleNodes.find((n) => n.isTeamHead && n.assignees.length > 0);
  const previousLeader = idOf(team.leader);
  const leader = head ? idOf(head.assignees[0]) : previousLeader;

  // The leader is never duplicated into members (see workTeam.repository.js).
  const memberIds = new Set((team.members || []).map(idOf));
  if (previousLeader && previousLeader !== leader) memberIds.add(previousLeader);
  for (const node of roleNodes) node.assignees.map(idOf).forEach((id) => memberIds.add(id));
  memberIds.delete(leader);

  team.leader = leader;
  team.members = [...memberIds];
  team.memberRoles = [...rolesByEmployee.entries()].map(([employee, roles]) => ({ employee, roles: [...roles] }));
  await team.save();
}

async function syncTeamsFor(nodeIds) {
  const nodes = await OrgNode.find({ _id: { $in: nodeIds } }).select('kind parent');
  const teamIds = new Set();
  for (const node of nodes) {
    if (node.kind === ORG_NODE_KIND.TEAM) teamIds.add(idOf(node._id));
    if (node.kind === ORG_NODE_KIND.TEAM_ROLE && node.parent) teamIds.add(idOf(node.parent));
  }
  for (const teamId of teamIds) {
    // eslint-disable-next-line no-await-in-loop
    await syncTeam(teamId);
  }
}

async function nextOrder(parentId) {
  const last = await OrgNode.findOne({ parent: parentId }).sort({ order: -1 }).select('order');
  return last ? last.order + 1 : 0;
}

// The access a box gives — only a position below the top box can give one.
function assertGrantable(kind, isRoot, grantsRole) {
  if (!grantsRole) return;
  if (isRoot) throw ApiError.badRequest('The Admin box gives admin access to the admin login only');
  if (kind !== ORG_NODE_KIND.POSITION) throw ApiError.badRequest('Only a position can give access');
}

async function createNode({ title, description, kind = ORG_NODE_KIND.POSITION, parent, workTeam, teamRole, isTeamHead, grantsRole }) {
  const hasRoot = await OrgNode.exists({ parent: null });
  if (!parent && hasRoot) throw ApiError.badRequest('There can only be one top box — choose a parent');
  assertGrantable(kind, !parent, grantsRole);
  if (parent) await assertValidPlacement({ kind, parentId: parent });
  if (kind === ORG_NODE_KIND.TEAM_ROLE && !teamRole) throw ApiError.badRequest('Choose which team role this is');
  if (kind === ORG_NODE_KIND.TEAM) await assertWorkTeamFree(workTeam, null);

  const node = await OrgNode.create({
    title,
    description,
    kind,
    parent: parent || null,
    order: await nextOrder(parent || null),
    workTeam: kind === ORG_NODE_KIND.TEAM ? workTeam || null : null,
    teamRole: kind === ORG_NODE_KIND.TEAM_ROLE ? teamRole : null,
    isTeamHead: kind === ORG_NODE_KIND.TEAM_ROLE ? Boolean(isTeamHead) : false,
    grantsRole: grantsRole || null,
  });
  if (node.kind === ORG_NODE_KIND.TEAM) await syncTeam(node._id);
  accessService.invalidate();
  return node;
}

// Title/description, and the kind-specific links. Changing a team box's
// linked work team, or a role box's role/head flag, re-syncs the team.
async function updateNode(id, { title, description, workTeam, teamRole, isTeamHead, grantsRole }) {
  const node = await findNodeOrThrow(id);
  if (title !== undefined) node.title = title;
  if (description !== undefined) node.description = description;
  if (grantsRole !== undefined) {
    assertGrantable(node.kind, !node.parent, grantsRole);
    node.grantsRole = grantsRole || null;
  }
  if (node.kind === ORG_NODE_KIND.TEAM && workTeam !== undefined) {
    await assertWorkTeamFree(workTeam, node._id);
    node.workTeam = workTeam || null;
  }
  if (node.kind === ORG_NODE_KIND.TEAM_ROLE) {
    if (teamRole !== undefined) node.teamRole = teamRole;
    if (isTeamHead !== undefined) node.isTeamHead = isTeamHead;
  }
  await node.save();
  await syncTeamsFor([node._id]);
  accessService.invalidate();
  return node;
}

// Moves a box (and everything under it) to a new parent and/or position
// among its siblings. `order` is the 0-based slot to land in; siblings are
// renumbered so orders stay 0..n-1.
async function moveNode(id, { parent, order }) {
  const node = await findNodeOrThrow(id);
  if (!node.parent) throw ApiError.badRequest('The top box cannot be moved');
  const oldParent = node.parent;
  const newParent = parent || node.parent;

  if (idOf(newParent) !== idOf(oldParent)) {
    if (await isSelfOrDescendant(node._id, newParent)) {
      throw ApiError.badRequest("A box can't move under itself or one of its own boxes");
    }
    await assertValidPlacement({ kind: node.kind, parentId: newParent });
  }

  const siblings = await OrgNode.find({ parent: newParent, _id: { $ne: node._id } }).sort({ order: 1, createdAt: 1 });
  const slot = order === undefined ? siblings.length : Math.max(0, Math.min(order, siblings.length));
  siblings.splice(slot, 0, node);
  node.parent = newParent;
  await Promise.all(
    siblings.map((sibling, index) => {
      sibling.order = index; // eslint-disable-line no-param-reassign
      return sibling.save();
    })
  );

  await syncTeamsFor([node._id, oldParent]);
  accessService.invalidate();
  return node;
}

// mode 'branch' deletes the box and everything under it; mode 'lift' moves
// its children up to its parent first (in its place, keeping their order).
async function deleteNode(id, { mode = 'lift' } = {}) {
  const node = await findNodeOrThrow(id);
  if (!node.parent) throw ApiError.badRequest('The top box cannot be deleted');
  const affectedTeams = [node.kind === ORG_NODE_KIND.TEAM_ROLE ? node.parent : null].filter(Boolean);

  if (mode === 'branch') {
    const ids = await descendantIds(node._id);
    await OrgNode.deleteMany({ _id: { $in: [node._id, ...ids] } });
  } else {
    const children = await OrgNode.find({ parent: node._id }).sort({ order: 1 });
    if (children.length > 0) await assertValidPlacementForChildren(children, node.parent);
    const siblings = await OrgNode.find({ parent: node.parent }).sort({ order: 1, createdAt: 1 });
    const reordered = siblings.flatMap((s) => (idOf(s._id) === idOf(node._id) ? children : [s]));
    await Promise.all(
      reordered.map((child, index) => {
        child.parent = node.parent; // eslint-disable-line no-param-reassign
        child.order = index; // eslint-disable-line no-param-reassign
        return child.save();
      })
    );
    await OrgNode.deleteOne({ _id: node._id });
  }

  // A deleted role box drops that role from the team (the role type is no
  // longer chart-managed, so remaining tags of it are left as they were —
  // clear the deleted box's own holders explicitly first).
  if (node.kind === ORG_NODE_KIND.TEAM_ROLE && node.teamRole && affectedTeams.length) {
    await clearRoleOnTeam(affectedTeams[0], node.teamRole, node.assignees);
  }
  await syncTeamsFor(affectedTeams);
  accessService.invalidate();
  return { deleted: idOf(node._id) };
}

async function assertValidPlacementForChildren(children, newParentId) {
  for (const child of children) {
    // eslint-disable-next-line no-await-in-loop
    await assertValidPlacement({ kind: child.kind, parentId: newParentId });
  }
}

async function clearRoleOnTeam(teamNodeId, role, employeeIds) {
  const teamNode = await OrgNode.findById(teamNodeId);
  if (!teamNode?.workTeam) return;
  const team = await WorkTeam.findOne({ _id: teamNode.workTeam, isDeleted: false });
  if (!team) return;
  const ids = new Set(employeeIds.map(idOf));
  team.memberRoles = (team.memberRoles || [])
    .map((entry) =>
      ids.has(idOf(entry.employee)) ? { employee: entry.employee, roles: entry.roles.filter((r) => r !== role) } : entry
    )
    .filter((entry) => entry.roles.length > 0);
  await team.save();
}

// Replaces who holds a box. Only active employees can be assigned.
async function setAssignees(id, employeeIds) {
  const node = await findNodeOrThrow(id);
  if (!node.parent) throw ApiError.badRequest('The Admin box is the admin login only — no one can be placed in it');
  const unique = [...new Set(employeeIds.map(String))];
  if (unique.length) {
    const employees = await employeeRepository.findByIds(unique);
    const active = new Set(employees.filter((e) => e.status === EMPLOYEE_STATUS.ACTIVE).map((e) => idOf(e._id)));
    const invalid = unique.filter((employeeId) => !active.has(employeeId));
    if (invalid.length) throw ApiError.badRequest('Only active employees can be assigned');
  }
  const removed = node.assignees.map(idOf).filter((employeeId) => !unique.includes(employeeId));
  node.assignees = unique;
  await node.save();
  if (node.kind === ORG_NODE_KIND.TEAM_ROLE && node.teamRole && removed.length) {
    await clearRoleOnTeam(node.parent, node.teamRole, removed);
  }
  await syncTeamsFor([node._id]);
  accessService.invalidate();
  return node;
}

// Off-boarding/removing an employee takes them out of every box they hold
// (those boxes show as Vacant until reassigned) and re-syncs their teams.
async function removeEmployeeEverywhere(employeeId) {
  const nodes = await OrgNode.find({ assignees: employeeId });
  if (nodes.length === 0) return;
  await OrgNode.updateMany({ assignees: employeeId }, { $pull: { assignees: employeeId } });
  await syncTeamsFor(nodes.map((n) => n._id));
  accessService.invalidate();
}

// Work teams not yet linked to a team box — for the "link a work team"
// picker when adding a new team box.
async function listLinkableWorkTeams() {
  const linked = await OrgNode.find({ workTeam: { $ne: null } }).distinct('workTeam');
  return WorkTeam.find({ isDeleted: false, isTemporary: { $ne: true }, _id: { $nin: linked } })
    .select('name')
    .sort({ name: 1 })
    .lean();
}

module.exports = {
  getTree,
  createNode,
  updateNode,
  moveNode,
  deleteNode,
  setAssignees,
  removeEmployeeEverywhere,
  listLinkableWorkTeams,
  syncTeam,
};
