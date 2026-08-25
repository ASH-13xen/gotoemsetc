const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { isAdminLike } = require('../utils/roles');
const { USER_ROLES, PERMISSIONS } = require('../config/constants');

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      employeeLink: payload.employeeLink || null,
      permissions: payload.permissions || [],
    };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

// Admins pass through unconditionally; anyone else only passes if
// req[source][paramName] matches their own linked Employee id — used on
// self-service reads (own employee record, own attendance, own device
// punches) that a worker must still be able to reach, unlike the flatly
// admin-only routes. `source` is 'params' for routes like /:id, 'query' for
// routes that take the target employee as a query string (?employeeId=…).
function requireSelfOrAdmin(paramName = 'id', source = 'params') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.employeeLink && req.user.employeeLink === req[source][paramName]) return next();
    return next(ApiError.forbidden());
  };
}

// Admins pass through unconditionally; anyone else needs at least one of
// the listed permissions granted on their credential (see User.permissions,
// set via Add Credentials). Cross-employee by design — e.g. `add_employee`
// or `generate_documents` inherently act on employees other than the
// grantee themselves.
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (perms.some((p) => req.user.permissions.includes(p))) return next();
    return next(ApiError.forbidden());
  };
}

// Admins and the record's own linked employee pass through unconditionally;
// anyone else needs the given permission — used where reading your own data
// is always fine, but reading/acting on someone else's needs the explicit
// grant (e.g. viewing/marking attendance). `source` mirrors requireSelfOrAdmin.
function requireSelfOrPermission(permission, paramName = 'id', source = 'params') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.employeeLink && req.user.employeeLink === req[source][paramName]) return next();
    if (req.user.permissions.includes(permission)) return next();
    return next(ApiError.forbidden());
  };
}

// Same admin/HR-equivalent bar as requirePermission(MARK_ATTENDANCE), plus
// explicitly letting the otherwise-unwired ceo role through too — used only
// on attendance-request approve/reject/revoke, where ceo needs sign-off
// authority even though it holds zero permissions like every other
// placeholder role (see USER_ROLES in constants.js).
function requireAttendanceApprovalAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    if (req.user.permissions.includes(PERMISSIONS.MARK_ATTENDANCE)) return next();
    return next(ApiError.forbidden());
  };
}

// admin/hr/ceo only — no permission-based bypass, unlike requirePermission.
// Used for HR Work's org-wide bulk tools (frontendhr): bulk salary slip
// generation, the org-wide attendance overview, the documents overview, and
// the inventory report — all act across every employee at once rather than
// on one employee a permission holder was explicitly granted access to, so
// a targeted permission grant (e.g. view_salary_slip on one credential)
// deliberately doesn't unlock them.
function requireHrWorkAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    return next(ApiError.forbidden());
  };
}

// admin/ceo/operations_manager only — deliberately NOT isAdminLike, since
// that includes HR and the whole point of this gate (per the product spec)
// is that HR does not have access to Operations. Used for the entire
// Operations module (complaint.routes.js's list/complete endpoints) — filing
// a complaint and reviewing your own are separate, self-scoped actions any
// employee can take, gated elsewhere.
function requireOperationsAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === USER_ROLES.ADMIN) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    if (req.user.role === USER_ROLES.OPERATIONS_MANAGER) return next();
    return next(ApiError.forbidden());
  };
}

// admin/ceo/account_manager only — deliberately NOT isAdminLike (HR has no
// business in Finance) and NOT operations_manager (see requireBillsAccess
// below for the one place that role is folded in). Backs the entire Finance
// module (/salary-slips finance routes, /fnf-settlements, /invoices,
// /monthly-bills, /reimbursements payment) except the narrower per-section
// gates called out in each of those routers (invoice approval and
// reimbursement approval are stricter; bills mark-paid is wider).
function requireFinanceAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === USER_ROLES.ADMIN) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    if (req.user.role === USER_ROLES.ACCOUNT_MANAGER) return next();
    return next(ApiError.forbidden());
  };
}

// Monthly Bills' mark-paid step specifically — your spec names "finance,
// operations, admin or ceo" for this one action, wider than the rest of
// Finance (see requireFinanceAccess above, which operations_manager does
// not pass). Reading/managing bill templates still requires full Finance
// access; only marking an instance paid uses this wider gate.
function requireBillsAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === USER_ROLES.ADMIN) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    if (req.user.role === USER_ROLES.ACCOUNT_MANAGER) return next();
    if (req.user.role === USER_ROLES.OPERATIONS_MANAGER) return next();
    return next(ApiError.forbidden());
  };
}

// Task Management's admin-style unified/filterable task view (client/team/
// employee/date, combinable). Widens the pre-existing isAdminLike/
// manage_tasks bar with CEO and the global Team Leader, who both need
// oversight across every team's work without gaining WorkTeam CRUD or any
// other manage_tasks-shaped authority — see requireTeamManagementAccess
// below for that, a deliberately separate, narrower grant.
function requireUnifiedTaskViewAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.role === USER_ROLES.CEO) return next();
    if (req.user.role === USER_ROLES.TEAM_LEAD) return next();
    if (req.user.permissions.includes(PERMISSIONS.MANAGE_TASKS)) return next();
    return next(ApiError.forbidden());
  };
}

// WorkTeam registry CRUD (create/edit/delete a team). isAdminLike/manage_tasks
// keep working exactly as before; TEAM_LEAD is added on top — the global
// Team Leader account owns Task Management administration company-wide, per
// this session's role split (WorkTeam.leader, displayed as "Team Main",
// keeps only its existing per-team authority — see utils/cmsAccess.js).
function requireTeamManagementAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.role === USER_ROLES.TEAM_LEAD) return next();
    if (req.user.permissions.includes(PERMISSIONS.MANAGE_TASKS)) return next();
    return next(ApiError.forbidden());
  };
}

// Any granted permission at all unlocks directory-style browsing (list all
// employees) — every permission requires first finding the employee to act
// on, so without this the permission would be unusable in practice.
function requireDirectoryAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user) || req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

// Same as requireDirectoryAccess, plus lets you always read your own record
// even with zero permissions granted — used on GET /employees/:id.
function requireSelfOrDirectoryAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (isAdminLike(req.user)) return next();
    if (req.user.employeeLink && req.user.employeeLink === req.params[paramName]) return next();
    if (req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

// Every login role except plain worker — admin/hr plus the 5 other
// leadership roles (ceo, digital_admin, team_lead, account_manager,
// operations_manager). Used only for creating an Announcement; any employee,
// worker included, can still read and acknowledge one addressed to them
// (self-scoped, gated elsewhere).
function requireAnnouncementCreateAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role !== USER_ROLES.WORKER) return next();
    return next(ApiError.forbidden());
  };
}

module.exports = {
  verifyToken,
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
