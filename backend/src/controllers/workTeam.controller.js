const asyncHandler = require('../utils/asyncHandler');
const workTeamService = require('../services/workTeam.service');

const list = asyncHandler(async (req, res) => {
  const teams = await workTeamService.listTeams();
  res.json({ teams });
});

const get = asyncHandler(async (req, res) => {
  const team = await workTeamService.getTeam(req.params.id);
  res.json({ team });
});

const create = asyncHandler(async (req, res) => {
  const team = await workTeamService.createTeam(req.body);
  req.auditContext = {
    action: 'workTeam.create',
    resourceType: 'WorkTeam',
    resourceId: team._id,
    metadata: { name: team.name },
  };
  res.status(201).json({ team });
});

const update = asyncHandler(async (req, res) => {
  const team = await workTeamService.updateTeam(req.params.id, req.body);
  req.auditContext = {
    action: 'workTeam.update',
    resourceType: 'WorkTeam',
    resourceId: team._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ team });
});

const remove = asyncHandler(async (req, res) => {
  await workTeamService.deleteTeam(req.params.id);
  req.auditContext = { action: 'workTeam.delete', resourceType: 'WorkTeam', resourceId: req.params.id };
  res.status(204).send();
});

module.exports = { list, get, create, update, remove };
