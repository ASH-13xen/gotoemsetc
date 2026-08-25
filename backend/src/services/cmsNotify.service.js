const notifyRecipients = require('./notifyRecipients.service');
const notificationService = require('./notification.service');
const userRepository = require('../repositories/user.repository');
const cmsWorkflow = require('./cmsWorkflow.service');
const teamRoles = require('../utils/teamRoles');
const { NOTIFICATION_TYPES, TEAM_MEMBER_ROLE } = require('../config/constants');

// Client tasks send no email (see employeeTask.service.js#sendsEmail), so
// these in-app notifications are the only signal a pipeline actor gets that
// something is sitting on them. That makes the routing here load-bearing
// rather than a nicety.

// Who's currently being waited on — resolved from the pipeline table
// (config/cmsPipelines.js) rather than a fixed smm/lead pair, since which
// actor type applies (a team role tag, a specific assignment, or the global
// Team Leader) now varies by step.
async function pendingActorUserIds(item, team) {
  const step = cmsWorkflow.nextStepConfig(item);
  if (!step?.actor) return [];
  const { actor } = step;

  if (actor.type === 'global_team_lead') {
    const leads = await userRepository.findTeamLeads();
    return leads.map((u) => u._id.toString());
  }
  if (actor.type === 'smm_or_lead') {
    const leadUserIds = (await userRepository.findTeamLeads()).map((u) => u._id.toString());
    const smmEmployeeIds = teamRoles.membersWithRole(team, TEAM_MEMBER_ROLE.SOCIAL_MEDIA_MANAGER);
    const smmUserIds = await notifyRecipients.resolveUserIdsForEmployees(smmEmployeeIds);
    return [...new Set([...leadUserIds, ...smmUserIds])];
  }
  // team_role or assignment — a fixed set of employees, resolved to users.
  const employeeIds = cmsWorkflow.actorEmployeeIds(actor, item, team);
  return notifyRecipients.resolveUserIdsForEmployees(employeeIds);
}

// Whoever actually did the work so far — a reel accumulates up to three
// doers across its steps.
function doerEmployeeIds(item) {
  return [item.assignments?.designer, item.assignments?.shooter, item.assignments?.editor, item.assignments?.contentManager].filter(
    Boolean
  );
}

function itemDescriptor(item) {
  const label = cmsWorkflow.labelFor(item);
  const client = item.client?.name;
  return client ? `${label} — ${client}` : label;
}

async function notifyStepPending(item, team) {
  const userIds = await pendingActorUserIds(item, team);
  if (userIds.length === 0) return;

  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.CMS_APPROVAL_PENDING,
    title: `Your turn — ${itemDescriptor(item)}`,
    message: `${itemDescriptor(item)} is waiting on you at "${item.stage.replace(/_/g, ' ')}".`,
  });
}

async function notifySentBack(item, team, note) {
  // Whoever now owns the step it was sent back to, plus every doer so far —
  // they need to know their work was sent back regardless of who acts next.
  const userIds = [...new Set([...(await pendingActorUserIds(item, team)), ...(await notifyRecipients.resolveUserIdsForEmployees(doerEmployeeIds(item)))])];
  if (userIds.length === 0) return;

  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.CMS_ITEM_SENT_BACK,
    title: `Sent back — ${itemDescriptor(item)}`,
    message: note ? `Reason: ${note}` : 'This item was sent back for changes.',
  });
}

async function notifyRejected(item, team, reason) {
  const userIds = await notifyRecipients.resolveUserIdsForEmployees(doerEmployeeIds(item));
  if (userIds.length === 0) return;

  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.CMS_ITEM_REJECTED,
    title: `Rejected — ${itemDescriptor(item)}`,
    message: reason ? `Reason: ${reason}` : 'This item was rejected.',
  });
}

async function notifyPublished(item, team) {
  const leadUserIds = (await userRepository.findTeamLeads()).map((u) => u._id.toString());
  const doerUserIds = await notifyRecipients.resolveUserIdsForEmployees(doerEmployeeIds(item));
  const userIds = [...new Set([...leadUserIds, ...doerUserIds])];
  if (userIds.length === 0) return;

  await notificationService.createForUsers(userIds, {
    type: NOTIFICATION_TYPES.CMS_ITEM_PUBLISHED,
    title: `Done — ${itemDescriptor(item)}`,
    message: `${itemDescriptor(item)} reached its final step.`,
  });
}

module.exports = {
  pendingActorUserIds,
  doerEmployeeIds,
  notifyStepPending,
  notifySentBack,
  notifyRejected,
  notifyPublished,
};
