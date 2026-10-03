const asyncHandler = require('../utils/asyncHandler');
const clientPortalAuthService = require('../services/clientPortalAuth.service');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await clientPortalAuthService.login(username, password);
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const client = await clientPortalAuthService.me(req.clientPortal.id);
  res.json({ client });
});

module.exports = { login, me };
