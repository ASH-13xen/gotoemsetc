const cmsAccess = require('../utils/cmsAccess');
const teamRoles = require('../utils/teamRoles');
const cmsPipelines = require('../config/cmsPipelines');
const { CMS_CONTENT_TYPE, CMS_STAGE_COLORS } = require('../config/constants');

const { toId } = cmsAccess;

// Pure decision logic for the CMS pipeline engine — no DB access, mirroring
// how this file worked before the per-type rewrite. The actual mutations
// (reading/writing CalendarItem and EmployeeTask, firing notifications) live
// in calendarItem.service.js, which calls into this file for every decision.

const { pipelineKindFor, currentStepConfig, nextStepConfig, isTerminal } = cmsPipelines;

// Resolves an actor descriptor (see config/cmsPipelines.js) against a
// specific item+team to the set of employee ids currently responsible.
// Synchronous — the global Team Leader case is handled separately by
// isGlobalTeamLead(user), since "every team_lead account" isn't a fact this
// function can answer without a DB call (see cmsNotify.service.js for the
// async, notification-facing equivalent).
function actorEmployeeIds(actor, item, team) {
  if (!actor) return [];
  if (actor.type === 'team_role') return teamRoles.membersWithRole(team, actor.role);
  if (actor.type === 'assignment') {
    const id = toId(item.assignments?.[actor.field]);
    return id ? [id] : [];
  }
  // global_team_lead and smm_or_lead resolve by role, not by a fixed
  // employee set — see canActOnCurrentStep below.
  return [];
}

// Can this user perform the action pending on `item` right now? Admin/CEO's
// "mark any step as completed" override always wins; otherwise the acting
// employee has to match whatever the next step's actor descriptor names.
function canActOnCurrentStep(user, item, team) {
  // Rejected is a closed, terminal state for everyone — not even the
  // admin/CEO override can act on it, matching "closes the task for all."
  if (item.isRejected) return false;
  if (isTerminal(item)) return false;
  if (cmsAccess.canForceCompleteAnyStep(user)) return true;

  const step = nextStepConfig(item);
  if (!step?.actor) return false;
  const { actor } = step;

  if (actor.type === 'global_team_lead') return cmsAccess.isGlobalTeamLead(user);
  if (actor.type === 'smm_or_lead') {
    return cmsAccess.isGlobalTeamLead(user) || cmsAccess.isTeamSocialMediaManager(user, team);
  }
  if (!user?.employeeLink) return false;
  return actorEmployeeIds(actor, item, team).includes(user.employeeLink.toString());
}

// Which role the acting user is standing in for, if any — null when they
// hold the next step's role themselves. Recorded on the stage history entry,
// same purpose as the old engine's identically-named helper.
function actingOnBehalfOf(user, item, team) {
  if (!cmsAccess.canForceCompleteAnyStep(user)) return null;
  const step = nextStepConfig(item);
  if (!step?.actor) return null;
  const { actor } = step;
  if (actor.type === 'global_team_lead') return cmsAccess.isGlobalTeamLead(user) ? null : 'team leader';
  if (actor.type === 'smm_or_lead') {
    return cmsAccess.isGlobalTeamLead(user) || cmsAccess.isTeamSocialMediaManager(user, team)
      ? null
      : 'social media manager or team leader';
  }
  const employeeId = user?.employeeLink?.toString();
  return employeeId && actorEmployeeIds(actor, item, team).includes(employeeId) ? null : 'the assigned person';
}

// Same-person auto-skip, carried forward from the old engine's one specific
// case: "the SMM is also the team leader" collapsed both approval gates
// rather than asking one person to rubber-stamp their own work twice.
// Generalised narrowly to *review* steps only (global_team_lead / smm_or_lead
// actors) — never to steps backed by a subtask (real work: a videographer
// being their own editor still has to actually edit, so that step is never
// skippable), and never to repeated manual SMM markers like "sent to
// client" → "client approved", which are structurally the same actor by
// design and are meant to stay separately tracked milestones, not collapse.
// A single look-ahead, matching the original one-hop case exactly rather
// than chaining indefinitely.
function autoSkipsFor(item, team, completingUser) {
  const step = nextStepConfig(item);
  if (!step || !step.actor || step.subtaskRole) return [];
  if (step.actor.type !== 'global_team_lead' && step.actor.type !== 'smm_or_lead') return [];
  return cmsAccess.isGlobalTeamLead(completingUser) ? [step.key] : [];
}

// The colour the calendar (and the Task Management stepper) paints this
// item. Pink/red are overrides on top of whatever stage the item is
// actually at, exactly like the old engine's isRejected — not stages of
// their own. Past-due carries forward too, generalised against each
// pipeline's own terminal step instead of the old shared PUBLISHED.
function colorFor(item, now = new Date()) {
  if (item.isRejected) return CMS_STAGE_COLORS.rejected;
  if (item.isSentBack) return CMS_STAGE_COLORS.sent_back;
  if (!isTerminal(item) && item.scheduledDate && new Date(item.scheduledDate) < now) {
    return CMS_STAGE_COLORS.overdue;
  }
  const kind = pipelineKindFor(item);
  return CMS_STAGE_COLORS[kind]?.[item.stage] || CMS_STAGE_COLORS[kind]?.created;
}

// "POST #1", "REEL #2", "STORY", "FESTIVE #1" — the heading a calendar cell
// shows. Daily stories aren't numbered: there can be several on one day and
// they're interchangeable, so a number would imply an ordering that doesn't
// exist.
function labelFor(item) {
  if (item.type === CMS_CONTENT_TYPE.STORY) return 'STORY';
  const prefix = item.type === CMS_CONTENT_TYPE.FESTIVE_STORY ? 'FESTIVE' : item.type.toUpperCase();
  return `${prefix} #${item.index}`;
}

// The full resolved step list for whichever pipeline this item follows, with
// each step's colour attached — what the Task Management stepper and the
// CMS item panel both render, resolved once server-side so heading/colour
// can't drift between the two views (same principle as labelFor/colorFor).
function stepTrail(item) {
  const kind = pipelineKindFor(item);
  const steps = cmsPipelines.stepsFor(kind);
  const currentIndex = cmsPipelines.currentStepIndex(item);
  return steps.map((step, index) => ({
    key: step.key,
    terminal: Boolean(step.terminal),
    color: CMS_STAGE_COLORS[kind]?.[step.key],
    reached: index <= currentIndex,
    current: index === currentIndex,
  }));
}

module.exports = {
  pipelineKindFor,
  currentStepConfig,
  nextStepConfig,
  isTerminal,
  actorEmployeeIds,
  canActOnCurrentStep,
  actingOnBehalfOf,
  autoSkipsFor,
  colorFor,
  labelFor,
  stepTrail,
};
