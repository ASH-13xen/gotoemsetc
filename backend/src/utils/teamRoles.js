// Pure helpers over an already-populated WorkTeam's memberRoles — no DB
// access, so the pipeline engine, notifications, and daily-story generation
// can all share one place that knows how to read the role tags. Mirrors the
// toId()-style pure-helper pattern already used in utils/cmsAccess.js and
// utils/taskAccess.js.

function toId(value) {
  if (!value) return null;
  return (value._id || value).toString();
}

// Every employee (id string) tagged with `role` on this team, leader
// included — a member can hold any number of the 9 roles at once, and
// there's deliberately no single "the" holder of a role: a team may have
// two Social Media Managers, and both get routed collectively.
function membersWithRole(team, role) {
  if (!team) return [];
  return (team.memberRoles || [])
    .filter((entry) => (entry.roles || []).includes(role))
    .map((entry) => toId(entry.employee))
    .filter(Boolean);
}

function hasRole(team, employeeId, role) {
  if (!employeeId) return false;
  return membersWithRole(team, role).includes(toId(employeeId));
}

module.exports = { membersWithRole, hasRole, toId };
