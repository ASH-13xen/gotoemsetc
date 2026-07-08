const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const { USER_ROLES } = require('../config/constants');

async function listUsers() {
  return userRepository.list();
}

async function getUser(id) {
  const user = await userRepository.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

function toCredentialView(user) {
  if (!user) return null;
  return { _id: user._id, username: user.username, role: user.role, isActive: user.isActive };
}

async function getCredentialForEmployee(employeeId) {
  const user = await userRepository.findByEmployeeId(employeeId);
  return toCredentialView(user);
}

// Employee-linked credentials always grant plain worker access — same
// permissions as any other worker, nothing employee-specific.
async function createCredential(employeeId, { username, password }) {
  const existing = await userRepository.findByEmployeeId(employeeId);
  if (existing) throw ApiError.conflict('This employee already has login credentials');

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await userRepository.create({
      username,
      passwordHash,
      role: USER_ROLES.WORKER,
      employeeLink: employeeId,
      isActive: true,
    });
    return toCredentialView(user);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Username already taken');
    throw err;
  }
}

async function updateCredential(userId, { username, password }) {
  const patch = {};
  if (username !== undefined) patch.username = username;
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await userRepository.updateById(userId, patch);
    if (!user) throw ApiError.notFound('Credential not found');
    return toCredentialView(user);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Username already taken');
    throw err;
  }
}

async function deleteCredential(userId) {
  const user = await userRepository.updateById(userId, { isActive: false });
  if (!user) throw ApiError.notFound('Credential not found');
  return toCredentialView(user);
}

module.exports = {
  listUsers,
  getUser,
  getCredentialForEmployee,
  createCredential,
  updateCredential,
  deleteCredential,
};
