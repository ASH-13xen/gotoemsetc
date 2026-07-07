const asyncHandler = require('../utils/asyncHandler');
const teamService = require('../services/team.service');

const list = asyncHandler(async (req, res) => {
  const teams = await teamService.listTeams();
  res.json({ teams });
});

const getById = asyncHandler(async (req, res) => {
  const team = await teamService.getTeam(req.params.id);
  res.json({ team });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.body);
  req.auditContext = { action: 'team.create', resourceType: 'Team', resourceId: team._id, metadata: req.body };
  res.status(201).json({ team });
});

const update = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.body);
  req.auditContext = { action: 'team.update', resourceType: 'Team', resourceId: team._id, metadata: req.body };
  res.json({ team });
});

const remove = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(req.params.id);
  req.auditContext = { action: 'team.delete', resourceType: 'Team', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
