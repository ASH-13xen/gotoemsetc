const ApiError = require('../utils/ApiError');
const teamRepository = require('../repositories/team.repository');

async function listTeams() {
  return teamRepository.list();
}

async function getTeam(id) {
  const team = await teamRepository.findById(id);
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

async function createTeam(data) {
  return teamRepository.create(data);
}

async function updateTeam(id, data) {
  const team = await teamRepository.updateById(id, data);
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

async function deleteTeam(id) {
  const team = await teamRepository.softDeleteById(id);
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

module.exports = { listTeams, getTeam, createTeam, updateTeam, deleteTeam };
