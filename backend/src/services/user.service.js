const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const userRepository = require('../repositories/user.repository');
const { USER_ROLES } = require('../config/constants');
const { isAdminLike } = require('../utils/roles');

// A non-admin granting permissions (via their own add_credentials grant)
// can only ever hand out a subset of what they themselves hold — otherwise
// a worker with just add_credentials could mint a credential with, say,
// view_salary_slip and hand it to someone (or reuse it), which is a real
// privilege-escalation path. Admins (and HR, admin-equivalent) are unrestricted.
function assertNoEscalation(requestedPermissions, actingUser) {
  if (!requestedPermissions || requestedPermissions.length === 0) return;
  if (isAdminLike(actingUser)) return;
  const granted = new Set(actingUser.permissions || []);
  const overreach = requestedPermissions.filter((p) => !granted.has(p));
  if (overreach.length > 0) {
    throw ApiError.forbidden(`You can't grant permissions you don't have: ${overreach.join(', ')}`);
  }
}

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
  return {
    _id: user._id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    permissions: user.permissions || [],
  };
}

async function getCredentialForEmployee(employeeId) {
  const user = await userRepository.findByEmployeeId(employeeId);
  return toCredentialView(user);
}

// Employee-linked credentials always grant plain worker access, optionally
// topped up with specific permissions the acting user (admin, or a worker
// with add_credentials) chooses to grant — see assertNoEscalation for the
// non-admin limit on what they're allowed to hand out.
async function createCredential(employeeId, { username, password, permissions }, actingUser) {
  const existing = await userRepository.findByEmployeeId(employeeId);
  if (existing) throw ApiError.conflict('This employee already has login credentials');

  assertNoEscalation(permissions, actingUser);

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await userRepository.create({
      username,
      passwordHash,
      role: USER_ROLES.WORKER,
      employeeLink: employeeId,
      isActive: true,
      permissions: permissions || [],
    });
    return toCredentialView(user);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Username already taken');
    throw err;
  }
}

async function updateCredential(userId, { username, password, permissions }, actingUser) {
  const patch = {};
  if (username !== undefined) patch.username = username;
  if (password) patch.passwordHash = await bcrypt.hash(password, 10);
  // Only an admin may change an existing credential's permissions — a
  // non-admin add_credentials holder can grant permissions at creation
  // time (within their own limit) but can't later escalate one further.
  if (permissions !== undefined && isAdminLike(actingUser)) {
    patch.permissions = permissions;
  }

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
