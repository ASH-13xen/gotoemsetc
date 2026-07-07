const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  res.json({ users });
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json({ user });
});

module.exports = { list, getById };
