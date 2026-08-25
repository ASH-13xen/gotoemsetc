const { ROLE_HIERARCHY } = require('../config/constants');

// Helpers for reading the org chart in constants.js.
//
// Read the warning there first: this describes reporting structure, it does
// NOT grant authority. Nothing in the request path calls these — they exist
// for display (ordering roles, labelling a dashboard) and as the agreed shape
// for a permission model that hasn't been built. If inherited access is ever
// wanted, it should be added explicitly at the routes, not implied here.

function roleNode(role) {
  return ROLE_HIERARCHY[role] || null;
}

function roleLabel(role) {
  return roleNode(role)?.label || role;
}

// 0 is the top (admin). Unknown roles sort last.
function roleLevel(role) {
  const node = roleNode(role);
  return node ? node.level : Number.MAX_SAFE_INTEGER;
}

// The chain from a role up to the root, e.g. team_lead -> ['ceo', 'admin'].
// Loop-guarded: a malformed reportsTo cycle would otherwise hang the process.
function chainAbove(role) {
  const chain = [];
  const seen = new Set([role]);
  let current = roleNode(role)?.reportsTo;

  while (current && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = roleNode(current)?.reportsTo;
  }
  return chain;
}

// Does `role` sit strictly above `other` in the chart? Structural only — see
// the warning above; this answers "who reports to whom", not "who may do what".
function isAbove(role, other) {
  return chainAbove(other).includes(role);
}

// Direct reports of a role.
function directReports(role) {
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, node]) => node.reportsTo === role)
    .map(([name]) => name);
}

// Every role, top-down then alphabetically — a stable order for pickers and
// admin screens that list roles.
function orderedRoles() {
  return Object.keys(ROLE_HIERARCHY).sort(
    (a, b) => roleLevel(a) - roleLevel(b) || a.localeCompare(b)
  );
}

module.exports = { roleNode, roleLabel, roleLevel, chainAbove, isAbove, directReports, orderedRoles };
