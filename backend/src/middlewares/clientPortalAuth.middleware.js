const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// Verifies a client-dashboard token specifically — signed with
// clientPortal.sessionSecret, not JWT_SECRET, and checked for
// type: 'client_portal' so an internal staff token (or vice versa) can
// never be replayed against the other surface even if the two secrets
// happened to match (local dev, where clientPortal.sessionSecret falls
// back to JWT_SECRET). Mirrors verifyToken in auth.middleware.js, kept
// separate rather than merged into it since the payload shape and the
// principal it establishes (req.clientPortal, not req.user) are different.
function requireClientPortalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.clientPortal.sessionSecret);
    if (payload.type !== 'client_portal') {
      return next(ApiError.unauthorized());
    }
    req.clientPortal = {
      id: payload.sub,
      taskClientId: payload.taskClientId,
      username: payload.username,
    };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

module.exports = { requireClientPortalAuth };
