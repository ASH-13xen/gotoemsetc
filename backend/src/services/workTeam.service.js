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

// Drops memberRoles entries for anyone no longer on the team, and entries
// left with an empty roles array. Without this, removing someone from the
// roster would leave their tags behind as an orphan the team form would
// happily re-render.
function pruneMemberRoles(data) {
  if (!Array.isArray(data.memberRoles)) return data;

  const roster = new Set(
    [...(Array.isArray(data.members) ? data.members : []), data.leader].filter(Boolean).map(String)
  );
  // On a true partial update with no roster in the payload there's nothing to
  // prune against, so leave the caller's list alone.
  if (roster.size === 0) return data;

  return {
    ...data,
    memberRoles: data.memberRoles.filter(
      (entry) => (entry.roles || []).length > 0 && roster.has(String(entry.employee))
    ),
  };
}

function normalize(data) {
  const withMembers = stripLeaderFromMembers(data);
  return pruneMemberRoles(withMembers);
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
    const created = await workTeamRepository.create(normalize(data));
    // .create() doesn't populate — re-fetch so leader/members/SMM come back
    // resolved, same as every other read of this resource.
    return await workTeamRepository.findById(created._id);
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A team with this name already exists');
    throw err;
  }
}

async function updateTeam(id, data) {
  try {
    const team = await workTeamRepository.updateById(id, normalize(data));
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
