const User = require('../models/User');
const OrgNode = require('../models/OrgNode');
const { USER_ROLES } = require('../config/constants');
const { accessForRoles, ROLE_RANK, ROLE_LABEL } = require('../config/access');

// ---------------------------------------------------------------------------
// Works out, live, what each signed-in person may do: their login's role
// plus the role of every Organisation chart post their employee holds (see
// config/access.js). Cached for 30 seconds so this isn't a database trip on
// every request; any chart or credential change clears the cache at once.
// ---------------------------------------------------------------------------

const TTL_MS = 30_000;
let orgCache = null;
const userCache = new Map();

const idOf = (v) => (v?._id ?? v)?.toString();

function invalidate() {
  orgCache = null;
  userCache.clear();
}

// From the chart: which roles each employee holds, and for each role, the
// roles of the posts above it (for "Approved by …" visibility).
async function orgMap() {
  if (orgCache && orgCache.expires > Date.now()) return orgCache;
  const nodes = await OrgNode.find({}).select('parent grantsRole assignees').lean();
  const byId = new Map(nodes.map((n) => [idOf(n._id), n]));

  const rolesByEmployee = new Map();
  for (const node of nodes) {
    if (!node.grantsRole) continue;
    for (const employeeId of node.assignees || []) {
      const key = idOf(employeeId);
      rolesByEmployee.set(key, new Set([...(rolesByEmployee.get(key) || []), node.grantsRole]));
    }
  }

  // Roles above `role`: the grantsRole of every ancestor of every post that
  // gives `role`, plus admin (the top of the chart) always.
  const above = new Map();
  for (const node of nodes) {
    if (!node.grantsRole) continue;
    const set = above.get(node.grantsRole) || new Set([USER_ROLES.ADMIN]);
    let current = node.parent ? byId.get(idOf(node.parent)) : null;
    while (current) {
      if (current.grantsRole) set.add(current.grantsRole);
      current = current.parent ? byId.get(idOf(current.parent)) : null;
    }
    above.set(node.grantsRole, set);
  }

  orgCache = { rolesByEmployee, above, expires: Date.now() + TTL_MS };
  return orgCache;
}

// The signed-in person as every check sees them, or null if the login is
// gone or deactivated.
async function resolveUser(userId) {
  const cached = userCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const user = await User.findById(userId)
    .select('username role permissions employeeLink isActive')
    .populate('employeeLink', 'firstName lastName status')
    .lean();
  let value = null;
  if (user && user.isActive) {
    const employee = user.employeeLink && typeof user.employeeLink === 'object' ? user.employeeLink : null;
    const org = await orgMap();
    const fromPosts = employee ? [...(org.rolesByEmployee.get(idOf(employee._id)) || [])] : [];
    const roles = [...new Set([user.role, ...fromPosts])].filter((r) => r !== USER_ROLES.ADMIN || user.role === USER_ROLES.ADMIN);
    value = {
      id: idOf(user._id),
      username: user.username,
      role: user.role,
      roles,
      postRoles: fromPosts,
      access: accessForRoles(roles),
      employeeLink: employee ? idOf(employee._id) : null,
      displayName: employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : user.username,
      permissions: user.permissions || [],
    };
  }
  userCache.set(userId, { value, expires: Date.now() + TTL_MS });
  return value;
}

// Every active login holding any of `roles` — the role's own account plus
// everyone whose employee holds a post giving it. Used for notifications.
async function findUsersWithRoles(roles) {
  const org = await orgMap();
  const employeeIds = [];
  for (const [employeeId, held] of org.rolesByEmployee) {
    if ([...held].some((r) => roles.includes(r))) employeeIds.push(employeeId);
  }
  return User.find({
    isActive: true,
    $or: [{ role: { $in: roles } }, ...(employeeIds.length ? [{ employeeLink: { $in: employeeIds } }] : [])],
  });
}

// Which of the actor's roles they used for an action several of their roles
// allow — the most senior one. `grantingRoles` = roles that allow it.
function actingRole(actor, grantingRoles) {
  const usable = (actor?.roles || []).filter((r) => grantingRoles.includes(r));
  return usable.sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0] || actor?.role || null;
}

// "Approved by Juhika (HR)" is shown only to Juhika herself, admin, and
// anyone holding a post above the role she acted in.
async function canSeeAttribution(viewer, { by, as }) {
  if (!viewer) return false;
  if (idOf(by) === viewer.id) return true;
  if (viewer.roles.includes(USER_ROLES.ADMIN)) return true;
  if (!as) return false;
  const org = await orgMap();
  const above = org.above.get(as) || new Set([USER_ROLES.ADMIN]);
  return viewer.roles.some((r) => above.has(r));
}

// Adds "who did it" to records for the viewer — or strips it when they're
// not allowed to see it. `specs` = [{ by: 'resolvedBy', as: 'resolvedAs' }…].
// A visible one gains `<by>Info: { name, as, asLabel }`; a hidden one loses
// both fields. Older records without an `as` fall back to the actor's login
// role (an HR-login approval reads as HR).
async function shapeAttribution(viewer, docs, specs) {
  const single = !Array.isArray(docs);
  const list = (single ? [docs] : docs).filter(Boolean).map((d) => (typeof d.toObject === 'function' ? d.toObject() : { ...d }));
  const ids = new Set();
  for (const d of list) for (const s of specs) if (d[s.by]) ids.add(idOf(d[s.by]));
  const users = ids.size
    ? await User.find({ _id: { $in: [...ids] } })
        .select('username role employeeLink')
        .populate('employeeLink', 'firstName lastName')
        .lean()
    : [];
  const byId = new Map(users.map((u) => [idOf(u._id), u]));

  for (const d of list) {
    for (const s of specs) {
      if (!d[s.by]) continue;
      const actor = byId.get(idOf(d[s.by]));
      const as = d[s.as] || (actor && actor.role !== USER_ROLES.WORKER ? actor.role : null);
      // eslint-disable-next-line no-await-in-loop
      if (await canSeeAttribution(viewer, { by: d[s.by], as })) {
        const employee = actor?.employeeLink;
        d[`${s.by}Info`] = {
          name: employee ? `${employee.firstName} ${employee.lastName || ''}`.trim() : `${ROLE_LABEL[actor?.role] || actor?.username || 'Someone'} login`,
          as,
          asLabel: as ? ROLE_LABEL[as] || as : null,
        };
      } else {
        delete d[s.by];
        delete d[s.as];
      }
    }
  }
  return single ? list[0] : list;
}

module.exports = { resolveUser, invalidate, findUsersWithRoles, actingRole, canSeeAttribution, orgMap, shapeAttribution };
