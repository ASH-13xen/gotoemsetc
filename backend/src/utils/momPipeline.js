// Pure decision logic for a MOM-spawned pipeline task's `momPipeline`
// sub-document — the off-calendar sibling of cmsWorkflow.service.js/
// config/cmsPipelines.js. Post/Reel kinds reuse the exact same declarative
// step tables and colours those use (just resolved against
// `momPipeline.assignments` instead of a CalendarItem's); Custom kinds are
// built fresh from whatever steps the meeting's MOM author defined, each
// with a single directly-assigned actor rather than a role lookup.
const cmsPipelinesConfig = require('../config/cmsPipelines');
const cmsAccess = require('./cmsAccess');
const teamRoles = require('./teamRoles');
const { CMS_STAGE_COLORS, MOM_PIPELINE_KIND } = require('../config/constants');

const { toId } = teamRoles;

function stepsFor(momPipeline) {
  if (momPipeline.kind === MOM_PIPELINE_KIND.CUSTOM) {
    const steps = momPipeline.customSteps || [];
    // A synthetic leading "created" marker, exactly like every other
    // pipeline's first entry — nothing to act on, it's just where a new
    // item starts, so the first *real* custom step is correctly seen as
    // "next" rather than already current.
    return [
      { key: 'created', color: null, actor: null, subtaskRole: null, terminal: false },
      ...steps.map((step, i) => ({
        key: step.key,
        color: step.color,
        actor: { type: 'direct_assignee', employeeId: toId(step.assignee) },
        subtaskRole: null,
        terminal: i === steps.length - 1,
      })),
    ];
  }
  return cmsPipelinesConfig.stepsFor(momPipeline.kind).map((step) => ({
    ...step,
    color: CMS_STAGE_COLORS[momPipeline.kind]?.[step.key],
  }));
}

function currentStepIndex(momPipeline) {
  const steps = stepsFor(momPipeline);
  const index = steps.findIndex((s) => s.key === momPipeline.stage);
  return index === -1 ? 0 : index;
}

function currentStepConfig(momPipeline) {
  return stepsFor(momPipeline)[currentStepIndex(momPipeline)];
}

function nextStepConfig(momPipeline) {
  return stepsFor(momPipeline)[currentStepIndex(momPipeline) + 1] || null;
}

function isTerminal(momPipeline) {
  return Boolean(currentStepConfig(momPipeline)?.terminal);
}

function actorEmployeeIds(actor, momPipeline, team) {
  if (!actor) return [];
  if (actor.type === 'direct_assignee') return actor.employeeId ? [actor.employeeId] : [];
  if (actor.type === 'team_role') return teamRoles.membersWithRole(team, actor.role);
  if (actor.type === 'assignment') {
    const id = toId(momPipeline.assignments?.[actor.field]);
    return id ? [id] : [];
  }
  return [];
}

function canActOnCurrentStep(user, momPipeline, team) {
  if (momPipeline.isRejected) return false;
  if (isTerminal(momPipeline)) return false;
  if (cmsAccess.canForceCompleteAnyStep(user)) return true;

  const step = nextStepConfig(momPipeline);
  if (!step?.actor) return false;
  const { actor } = step;
  if (actor.type === 'global_team_lead') return cmsAccess.isGlobalTeamLead(user);
  if (actor.type === 'smm_or_lead') {
    return cmsAccess.isGlobalTeamLead(user) || cmsAccess.isTeamSocialMediaManager(user, team);
  }
  if (!user?.employeeLink) return false;
  return actorEmployeeIds(actor, momPipeline, team).includes(user.employeeLink.toString());
}

function colorFor(momPipeline) {
  if (momPipeline.isRejected) return CMS_STAGE_COLORS.rejected;
  if (momPipeline.isSentBack) return CMS_STAGE_COLORS.sent_back;
  return currentStepConfig(momPipeline)?.color || '#94a3b8';
}

function stepTrail(momPipeline) {
  const steps = stepsFor(momPipeline);
  const idx = currentStepIndex(momPipeline);
  return steps.map((step, i) => ({
    key: step.key,
    terminal: Boolean(step.terminal),
    color: step.color,
    reached: i <= idx,
    current: i === idx,
  }));
}

// Which subtasks a Post/Reel momPipeline breaks into — derived from the
// exact same step table as calendarItem.service.js#subtaskPlan, filtered to
// the assignment-backed steps (Custom kinds never get subtasks; a step's
// single assignee acts straight from the calendar-free task itself).
function subtaskPlanFor(kind, assignments) {
  const steps = cmsPipelinesConfig.stepsFor(kind).filter((s) => s.subtaskRole && s.actor.type === 'assignment');
  const plans = [];
  let previousRole = null;
  for (const step of steps) {
    const assigneeId = toId(assignments?.[step.actor.field]);
    if (assigneeId) plans.push({ role: step.subtaskRole, assignee: assigneeId, blockedByRole: previousRole });
    previousRole = step.subtaskRole;
  }
  return plans;
}

module.exports = {
  stepsFor,
  currentStepIndex,
  currentStepConfig,
  nextStepConfig,
  isTerminal,
  actorEmployeeIds,
  canActOnCurrentStep,
  colorFor,
  stepTrail,
  subtaskPlanFor,
};
