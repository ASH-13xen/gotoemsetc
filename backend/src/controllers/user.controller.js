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

const getForEmployee = asyncHandler(async (req, res) => {
  const credential = await userService.getCredentialForEmployee(req.params.employeeId);
  res.json({ credential });
});

const createForEmployee = asyncHandler(async (req, res) => {
  const credential = await userService.createCredential(req.params.employeeId, req.body);
  res.status(201).json({ credential });
});

const updateCredential = asyncHandler(async (req, res) => {
  const credential = await userService.updateCredential(req.params.id, req.body);
  res.json({ credential });
});

const removeCredential = asyncHandler(async (req, res) => {
  const credential = await userService.deleteCredential(req.params.id);
  res.json({ credential });
});

module.exports = { list, getById, getForEmployee, createForEmployee, updateCredential, removeCredential };
