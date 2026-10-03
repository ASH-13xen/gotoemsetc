const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const clientPortalAccountRepository = require('../repositories/clientPortalAccount.repository');

// The client dashboard's whole reason for existing right now (no features
// yet, see clientdashboard/ — this is deliberately just login + theme):
// name/logo/colors to repaint the shell in, nothing about the client's
// actual CMS data.
function toPublicProfile(account) {
  const client = account.taskClient;
  return {
    id: account._id,
    username: account.username,
    clientName: client?.name,
    brandName: client?.brandName,
    logoUrl: client?.logoUrl || null,
    theme: {
      primaryColor: account.theme.primaryColor,
      secondaryColor: account.theme.secondaryColor,
    },
  };
}

async function login(username, password) {
  const account = await clientPortalAccountRepository.findByUsername(username);
  if (!account) throw ApiError.unauthorized('Invalid credentials');

  const matches = await bcrypt.compare(password, account.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  const token = jwt.sign(
    {
      sub: account._id.toString(),
      type: 'client_portal',
      taskClientId: account.taskClient._id.toString(),
      username: account.username,
    },
    env.clientPortal.sessionSecret,
    { expiresIn: env.clientPortal.sessionTtl }
  );

  return { token, client: toPublicProfile(account) };
}

async function me(accountId) {
  const account = await clientPortalAccountRepository.findById(accountId);
  if (!account || !account.isActive) throw ApiError.unauthorized();
  return toPublicProfile(account);
}

module.exports = { login, me };
