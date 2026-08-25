const { USER_ROLES, TEAM_MEMBER_ROLE } = require('../config/constants');
const { isAdminLike } = require('./roles');
const teamRoles = require('./teamRoles');

// Access rules for the Client Management System, deliberately kept separate
// from roles.js's isAdminLike(). Keeping them apart is what lets a role own
// the CMS without also inheriting every admin capability across EMS and Task
// Management (salary slips, attendance edits, employee PII, credentials) —
// isAdminLike's ~70 call sites are all outside this module.
//
// Tiers:
//   admin          — full CRUD on every client, plus the "force-complete any
//                     step" override (with ceo, see canForceCompleteAnyStep)
//   digital admin  — full CRUD on every client (isCmsAdmin's other holder)
//   hr             — read-only, every client
//   global Team Leader — not tied to any team; owns the "lead" step of every
//                     team's client pipeline, company-wide
//   Team Main (WorkTeam.leader) — read/schedule/assign their own team's work
//   team member    — read their own team's clients; acts on whichever
//                     pipeline step their role tag makes them responsible for
//
// isCmsAdmin was admin + sales until the sales role was removed from the org
// chart, then admin-only with account_manager/digital_admin named as
// candidates — now admin + digital_admin, closing that gap.
function isCmsAdmin(user) {
  return Boolean(user) && (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.DIGITAL_ADMIN);
}

// The company-wide Team Leader — the team_lead login role, deliberately not
// tied to any one team (contrast WorkTeam.leader/"Team Main", which is).
// Owns the "lead" step of every pipeline and Task Management's team
// registry (see requireTeamManagementAccess in auth.middleware.js).
function isGlobalTeamLead(user) {
  return Boolean(user) && user.role === USER_ROLES.TEAM_LEAD;
}

// The literal "CEO and admin can mark any step as completed" rule from the
// spec — independent of isCmsAdmin, since it's narrower (CEO gets to force
// a step through without also gaining Digital Admin's client/plan-editing
// rights). Every pipeline-step authorization check folds this in.
function canForceCompleteAnyStep(user) {
  return Boolean(user) && (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.CEO);
}

// HR sees everything and can change nothing. Every other logged-in employee
// gets in too, but scoped to their own teams' clients by visibleClientIds().
function canReadCms(user) {
  return Boolean(user);
}

// Write access to client records, plans, and calendars themselves.
function canWriteCms(user) {
  return isCmsAdmin(user);
}

const { toId } = teamRoles;

function isSameEmployee(user, employeeRef) {
  if (!user?.employeeLink || !employeeRef) return false;
  return toId(employeeRef) === user.employeeLink.toString();
}

// Requires a populated WorkTeam. This is Team Main's local authority — the
// per-team leader field, unrelated to isGlobalTeamLead above.
function isTeamLeader(user, team) {
  return isSameEmployee(user, team?.leader);
}

// Any employee tagged Social Media Manager on this team — there may be more
// than one, in which case any of them may act (see teamRoles.hasRole).
function isTeamSocialMediaManager(user, team) {
  if (!user?.employeeLink || !team) return false;
  return teamRoles.hasRole(team, user.employeeLink, TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER);
}

// Leader OR member — a WorkTeam's leader is never duplicated into `members`
// (see workTeam.service.js), so both have to be checked.
function isOnTeam(user, team) {
  if (!user?.employeeLink || !team) return false;
  const employeeId = user.employeeLink.toString();
  if (toId(team.leader) === employeeId) return true;
  return (team.members || []).some((m) => toId(m) === employeeId);
}

// Scheduling and assignment: CMS admins anywhere, Team Main only on their
// own team's work. Note this is narrower than canWriteCms — Team Main can
// schedule content but can't edit the client record or change the plan.
function canScheduleForTeam(user, team) {
  return isCmsAdmin(user) || isTeamLeader(user, team);
}

// Meetings/MOM: Team Main, the global Team Leader, and CEO all get the same
// access — scheduling, logging, rescheduling, cancelling, and writing the
// MOM itself. Plus the usual admin override via isCmsAdmin.
function canManageMeetings(user, team) {
  return (
    isCmsAdmin(user) ||
    isGlobalTeamLead(user) ||
    user?.role === USER_ROLES.CEO ||
    isTeamLeader(user, team)
  );
}

module.exports = {
  isCmsAdmin,
  isGlobalTeamLead,
  canForceCompleteAnyStep,
  canReadCms,
  canWriteCms,
  isTeamLeader,
  isTeamSocialMediaManager,
  isOnTeam,
  canScheduleForTeam,
  canManageMeetings,
  toId,
  // Re-exported so CMS route files never need to import roles.js directly and
  // accidentally reach for isAdminLike when they meant isCmsAdmin.
  isAdminLike,
};
