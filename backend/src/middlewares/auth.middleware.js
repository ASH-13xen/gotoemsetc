const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

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
    if (req.user.role === 'admin') return next();
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
    if (req.user.role === 'admin') return next();
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
    if (req.user.role === 'admin') return next();
    if (req.user.employeeLink && req.user.employeeLink === req[source][paramName]) return next();
    if (req.user.permissions.includes(permission)) return next();
    return next(ApiError.forbidden());
  };
}

// Any granted permission at all unlocks directory-style browsing (list all
// employees) — every permission requires first finding the employee to act
// on, so without this the permission would be unusable in practice.
function requireDirectoryAccess() {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin' || req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

// Same as requireDirectoryAccess, plus lets you always read your own record
// even with zero permissions granted — used on GET /employees/:id.
function requireSelfOrDirectoryAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    if (req.user.employeeLink && req.user.employeeLink === req.params[paramName]) return next();
    if (req.user.permissions.length > 0) return next();
    return next(ApiError.forbidden());
  };
}

module.exports = {
  verifyToken,
  requireRole,
  requireSelfOrAdmin,
  requirePermission,
  requireSelfOrPermission,
  requireDirectoryAccess,
  requireSelfOrDirectoryAccess,
};
