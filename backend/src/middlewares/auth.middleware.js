const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { hasRole, can, isSelf } = require('../utils/roles');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');
const { ACCESS } = require('../config/access');
const accessService = require('../services/access.service');

// Besides the signature, the account must still exist and be active — so a
// credential deleted by hand, or revoked by off-boarding the employee (see
// employee.service.js#updateEmployee), is locked out immediately rather
// than staying usable until its token expires. Roles and access are worked
// out live (access.service.js) — never trusted from the token — so taking
// someone off a post in the Organisation chart removes that access within
// seconds, without them signing out.
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  try {
    const user = await accessService.resolveUser(payload.sub);
    if (!user) return next(ApiError.unauthorized('This account no longer has access'));
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

const deny = (req, next) => next(req.user ? ApiError.forbidden() : ApiError.unauthorized());

// The person must be able to do this (an ACCESS key from config/access.js).
function requireAccess(...accessKeys) {
  return (req, res, next) => {
    if (req.user && accessKeys.some((key) => can(req.user, key))) return next();
    return deny(req, next);
  };
}

// Holds one of these roles, by login or by post. Prefer requireAccess —
// this is for the few literal-role gates (e.g. HR filing change requests).
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user && hasRole(req.user, ...roles)) return next();
    return deny(req, next);
  };
}

const hasPermission = (user, perms) => perms.some((p) => user.permissions.includes(p));

// Their own employee record, or anyone with EMS-for-everyone access.
// `source` is 'params' for routes like /:id, 'query' for ?employeeId=….
function requireSelfOrAdmin(paramName = 'id', source = 'params') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.EMS_ALL)) return next();
    if (isSelf(req.user, req[source][paramName])) return next();
    return next(ApiError.forbidden());
  };
}

// EMS-for-everyone access (which includes every EMS permission), or one of
// the listed permissions granted on their own credential via Add Credentials.
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.EMS_ALL)) return next();
    if (hasPermission(req.user, perms)) return next();
    return next(ApiError.forbidden());
  };
}

// Own record always; anyone else's needs EMS-for-everyone or the permission.
function requireSelfOrPermission(permission, paramName = 'id', source = 'params') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.EMS_ALL)) return next();
    if (isSelf(req.user, req[source][paramName])) return next();
    if (req.user.permissions.includes(permission)) return next();
    return next(ApiError.forbidden());
  };
}

// Approving/rejecting/revoking leave and attendance requests: HRMS, or a
// credential granted mark_attendance.
function requireAttendanceApprovalAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.HRMS)) return next();
    if (req.user.permissions.includes(PERMISSIONS.MARK_ATTENDANCE)) return next();
    return next(ApiError.forbidden());
  };
}

// HR Work (HRMS) — the org-wide bulk tools.
const requireHrWorkAccess = () => requireAccess(ACCESS.HRMS);
// Operations tab.
const requireOperationsAccess = () => requireAccess(ACCESS.OPERATIONS);
// Finance tab — monthly bills included.
const requireFinanceAccess = () => requireAccess(ACCESS.FINANCE);
const requireBillsAccess = () => requireAccess(ACCESS.FINANCE);

// Task Management (hidden for now) — its old rules, by role.
function requireUnifiedTaskViewAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (hasRole(req.user, USER_ROLES.ADMIN, USER_ROLES.HR, USER_ROLES.CEO, USER_ROLES.TEAM_LEAD)) return next();
    if (req.user.permissions.includes(PERMISSIONS.MANAGE_TASKS)) return next();
    return next(ApiError.forbidden());
  };
}

function requireTeamManagementAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (hasRole(req.user, USER_ROLES.ADMIN, USER_ROLES.HR, USER_ROLES.TEAM_LEAD)) return next();
    if (req.user.permissions.includes(PERMISSIONS.MANAGE_TASKS)) return next();
    return next(ApiError.forbidden());
  };
}

// Browsing the full employee directory: EMS-for-everyone, or any granted
// permission (you have to find an employee before acting on them).
function requireDirectoryAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.EMS_ALL) || req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

// Same, plus your own record always — GET /employees/:id.
function requireSelfOrDirectoryAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (can(req.user, ACCESS.EMS_ALL)) return next();
    if (isSelf(req.user, req.params[paramName])) return next();
    if (req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

const requireAnnouncementCreateAccess = () => requireAccess(ACCESS.ANNOUNCEMENTS_CREATE);

module.exports = {
  verifyToken,
  requireAccess,
  requireRole,
  requireSelfOrAdmin,
  requirePermission,
  requireSelfOrPermission,
  requireAttendanceApprovalAccess,
  requireHrWorkAccess,
  requireOperationsAccess,
  requireFinanceAccess,
  requireBillsAccess,
  requireTeamManagementAccess,
  requireUnifiedTaskViewAccess,
  requireDirectoryAccess,
  requireSelfOrDirectoryAccess,
  requireAnnouncementCreateAccess,
};
