const employeeTaskRepository = require('../repositories/employeeTask.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const { istParts } = require('../utils/istDate');
const { isGlobalTeamLead } = require('../utils/cmsAccess');

const DIGEST_HOUR = 18;
const DIGEST_MINUTE = 30;

// The "at 6:30pm" gate — enforced here (server-side, IST) rather than
// trusting the client's clock, same reasoning as every other IST cutoff in
// this codebase.
function isPastGateTime(now) {
  const { hour, minute } = istParts(now);
  return hour > DIGEST_HOUR || (hour === DIGEST_HOUR && minute >= DIGEST_MINUTE);
}

function hasTasks(bucket) {
  return bucket.overdue.length > 0 || bucket.tomorrow.length > 0;
}

async function teamDigests(teamIds, now) {
  if (!teamIds.length) return [];
  const allTeams = await workTeamRepository.list();
  const teams = allTeams.filter((team) => teamIds.some((id) => String(id) === String(team._id)));
  return Promise.all(
    teams.map(async (team) => ({
      team: { _id: team._id, name: team.name },
      ...(await employeeTaskRepository.listDueTomorrowAndOverdueForTeam(team._id, now)),
    }))
  );
}

// Returns null when there's nothing to show — either it's before 6:30pm IST,
// or the employee genuinely has a clean board. The frontend renders nothing
// in either case, so there's no need to distinguish them in the response.
async function getDigest(user, now = new Date()) {
  if (!isPastGateTime(now)) return null;
  if (!user.employeeLink) return null;

  const employeeId = user.employeeLink;
  const mine = await employeeTaskRepository.listDueTomorrowAndOverdueForEmployee(employeeId, now);

  // The global Team Leader role reviews every team; a plain Team Main
  // (WorkTeam.leader) only reviews the team(s) they personally lead.
  const teamIds = isGlobalTeamLead(user)
    ? (await workTeamRepository.list()).map((t) => t._id)
    : await employeeTaskRepository.findLedTeamIds(employeeId);
  const teams = await teamDigests(teamIds, now);

  if (!hasTasks(mine) && !teams.some(hasTasks)) return null;
  return { mine, teams };
}

module.exports = { getDigest };
