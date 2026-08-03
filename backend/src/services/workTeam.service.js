const ApiError = require('../utils/ApiError');
const workTeamRepository = require('../repositories/workTeam.repository');

// The leader is already part of the team by definition — never also stored
// in `members`, regardless of what a caller sends. Only meaningful when
// both fields are present in the same payload (always true for create;
// true for update too, since the form always resubmits the full team
// rather than a true partial diff).
function stripLeaderFromMembers(data) {
  if (!data.leader || !Array.isArray(data.members)) return data;
  return { ...data, members: data.members.filter((id) => String(id) !== String(data.leader)) };
}

async function listTeams() {
  return workTeamRepository.list();
}

async function getTeam(id) {
  const team = await workTeamRepository.findById(id);
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

async function createTeam(data) {
  try {
    return await workTeamRepository.create(stripLeaderFromMembers(data));
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A team with this name already exists');
    throw err;
  }
}

async function updateTeam(id, data) {
  try {
    const team = await workTeamRepository.updateById(id, stripLeaderFromMembers(data));
    if (!team) throw ApiError.notFound('Team not found');
    return team;
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A team with this name already exists');
    throw err;
  }
}

async function deleteTeam(id) {
  const team = await workTeamRepository.softDeleteById(id);
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

module.exports = { listTeams, getTeam, createTeam, updateTeam, deleteTeam };
