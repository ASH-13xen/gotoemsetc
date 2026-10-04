const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const accessService = require('./access.service');
const { FEATURES } = require('../config/constants');

// What the apps get about the signed-in person: their login role, plus the
// live roles (login + Organisation chart posts) and the access those give —
// the apps show menus, pages and buttons from `access` (config/access.js).
function toPublicUser(resolved) {
  return {
    id: resolved.id,
    username: resolved.username,
    role: resolved.role,
    roles: resolved.roles,
    postRoles: resolved.postRoles,
    access: resolved.access,
    displayName: resolved.displayName,
    employeeLink: resolved.employeeLink,
    permissions: resolved.permissions,
    // Which whole sections are switched on (constants.js FEATURES).
    features: FEATURES,
  };
}

async function login(username, password) {
  const user = await userRepository.findByUsername(username);
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
      employeeLink: user.employeeLink ? user.employeeLink.toString() : null,
      permissions: user.permissions || [],
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  const resolved = await accessService.resolveUser(user._id.toString());
  if (!resolved) throw ApiError.unauthorized('This account no longer has access');
  return { token, user: toPublicUser(resolved) };
}

async function me(userId) {
  const resolved = await accessService.resolveUser(userId);
  if (!resolved) throw ApiError.unauthorized();
  return toPublicUser(resolved);
}

module.exports = { login, me };
