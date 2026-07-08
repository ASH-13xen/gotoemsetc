const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');

function toPublicUser(user) {
  return { id: user._id, username: user.username, role: user.role, employeeLink: user.employeeLink };
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
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return { token, user: toPublicUser(user) };
}

async function me(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.unauthorized();
  return toPublicUser(user);
}

module.exports = { login, me };
