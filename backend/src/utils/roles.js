const { USER_ROLES } = require('../config/constants');

// Helpers over the signed-in person built by access.service.js#resolveUser:
// `roles` = their login's role plus every Organisation chart post they hold,
// `access` = what those roles allow (config/access.js).

const rolesOf = (user) => user?.roles || (user?.role ? [user.role] : []);

// Holds any of these roles (by login or by post).
function hasRole(user, ...roles) {
  const held = rolesOf(user);
  return roles.some((r) => held.includes(r));
}

// May do this (an ACCESS key from config/access.js).
function can(user, accessKey) {
  return Boolean(user?.access?.includes(accessKey));
}

// Is `employeeId` the person's own employee record?
function isSelf(user, employeeId) {
  return Boolean(user?.employeeLink) && Boolean(employeeId) && String(employeeId?._id ?? employeeId) === String(user.employeeLink);
}

// Legacy admin-or-HR test, kept only for Task Management and Client
// Management, which are hidden for now and keep their old rules.
function isAdminLike(user) {
  return hasRole(user, USER_ROLES.ADMIN, USER_ROLES.HR);
}

module.exports = { hasRole, can, isSelf, isAdminLike };
