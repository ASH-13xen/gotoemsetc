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

module.exports = { verifyToken, requireRole, requireSelfOrAdmin };
