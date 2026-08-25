const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');
const meetingRepository = require('../repositories/meeting.repository');
const taskClientRepository = require('../repositories/taskClient.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const employeeRepository = require('../repositories/employee.repository');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const notifyRecipients = require('./notifyRecipients.service');
const employeeTaskService = require('./employeeTask.service');
const momPipelineService = require('./momPipeline.service');
const cmsAccess = require('../utils/cmsAccess');
const { MEETING_STATUS, NOTIFICATION_TYPES, MOM_TASK_KIND, MOM_PIPELINE_KIND, EMPLOYEE_TASK_TYPE } = require('../config/constants');

const { toId } = cmsAccess;

// Same pattern as employeeTask.service.js#taskManagerFrom — reuses the one
// verified RESEND_FROM_EMAIL address under a different display name, no new
// env var or domain verification needed.
function meetingsFrom() {
  const match = /<([^>]+)>/.exec(env.resend.fromEmail || '');
  const address = match ? match[1] : env.resend.fromEmail;
  return `Client Management <${address}>`;
}

async function loadClientAndTeam(clientId) {
  const client = await taskClientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');
  const team = client.defaultTeam ? await workTeamRepository.findById(toId(client.defaultTeam)) : null;
  return { client, team };
}

// Participants must be on the client's currently-assigned team at schedule
// time — validated here, then left alone afterward so the invite list stays
// historically accurate even if the roster later changes.
function assertParticipantsOnTeam(participantIds, team) {
  if (!team) throw ApiError.badRequest('This client has no team assigned — assign one before scheduling a meeting.');
  const roster = new Set([toId(team.leader), ...team.members.map((m) => toId(m))]);
  const invalid = participantIds.filter((id) => !roster.has(id));
  if (invalid.length > 0) {
    throw ApiError.badRequest('Every participant must be on the client\'s assigned team.');
  }
}

function meetingDescriptor(meeting) {
  const clientName = meeting.client?.name || meeting.client?.brandName || 'Client';
  return `${clientName} — ${new Date(meeting.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

async function notifyParticipants(meeting, { type, title, message }) {
  const userIds = await notifyRecipients.resolveUserIdsForEmployees(meeting.participants.map((p) => toId(p)));
  if (userIds.length === 0) return;
  await notificationService.createForUsers(userIds, { type, title, message, meeting: meeting._id });
}

async function emailParticipants(meeting, { subject, html }) {
  const employees = await Promise.all(meeting.participants.map((p) => employeeRepository.findById(toId(p))));
  const COMPANY_EMAIL_KEY = 'COMPANY MAIL ID';
  for (const employee of employees) {
    if (!employee) continue;
    const entry = (employee.extraDetails || []).find((d) => d.key?.trim().toUpperCase() === COMPANY_EMAIL_KEY);
    const to = entry?.value?.trim();
    if (!to) continue;
    await emailService
      .sendEmail({ to, subject, html, from: meetingsFrom() })
      .catch((err) => logger.error({ err, to }, 'Failed to send meeting email'));
  }
}

function meetingEmailHtml(meeting, heading, extra = '') {
  return `<p>Hi,</p>
<p>${heading}</p>
<p><strong>Client:</strong> ${meeting.client?.name || ''}<br/>
<strong>When:</strong> ${new Date(meeting.scheduledAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}<br/>
<strong>Where:</strong> ${meeting.meetingType === 'online' ? meeting.meetingLink || 'Online' : meeting.location || 'In person'}</p>
${extra}
<p>Thanks,<br/>Client Management</p>`;
}

async function listForClient(clientId) {
  return meetingRepository.listForClient(clientId);
}

async function getMeeting(id) {
  const meeting = await meetingRepository.findById(id);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  return meeting;
}

// Schedules a future meeting: emails + notifies every participant.
async function scheduleMeeting({ clientId, scheduledAt, meetingType, location, meetingLink, participants }, actingUser) {
  const { team } = await loadClientAndTeam(clientId);
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to schedule a meeting for this client.");
  }
  assertParticipantsOnTeam(participants, team);

  const created = await meetingRepository.create({
    client: clientId,
    scheduledAt: new Date(scheduledAt),
    meetingType,
    location,
    meetingLink,
    participants,
    createdBy: actingUser.id,
  });
  const meeting = await meetingRepository.findById(created._id);

  await notifyParticipants(meeting, {
    type: NOTIFICATION_TYPES.MEETING_SCHEDULED,
    title: 'Meeting scheduled',
    message: meetingDescriptor(meeting),
  });
  await emailParticipants(meeting, {
    subject: `Meeting scheduled — ${meeting.client?.name || 'Client'}`,
    html: meetingEmailHtml(meeting, 'A meeting has been scheduled.'),
  });

  return meeting;
}

// Records a meeting that already happened — starts 'completed' immediately,
// MOM can be added right away, no reminder/late-flag logic applies.
async function logMeeting({ clientId, scheduledAt, meetingType, location, meetingLink, participants }, actingUser) {
  const { team } = await loadClientAndTeam(clientId);
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to log a meeting for this client.");
  }
  assertParticipantsOnTeam(participants, team);

  const created = await meetingRepository.create({
    client: clientId,
    scheduledAt: new Date(scheduledAt),
    meetingType,
    location,
    meetingLink,
    participants,
    isLogged: true,
    status: MEETING_STATUS.COMPLETED,
    createdBy: actingUser.id,
  });
  return meetingRepository.findById(created._id);
}

async function rescheduleMeeting(id, newScheduledAt, actingUser) {
  const meeting = await getMeeting(id);
  const { team } = await loadClientAndTeam(toId(meeting.client));
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to reschedule this meeting.");
  }
  if (meeting.status === MEETING_STATUS.CANCELLED) throw ApiError.badRequest('This meeting is cancelled.');

  const from = meeting.scheduledAt;
  const to = new Date(newScheduledAt);
  const updated = await meetingRepository.updateById(id, {
    scheduledAt: to,
    rescheduledAt: new Date(),
    $push: { rescheduleHistory: { from, to, at: new Date(), by: actingUser.id } },
  });

  await notifyParticipants(updated, {
    type: NOTIFICATION_TYPES.MEETING_RESCHEDULED,
    title: 'Meeting rescheduled',
    message: meetingDescriptor(updated),
  });
  await emailParticipants(updated, {
    subject: `Meeting rescheduled — ${updated.client?.name || 'Client'}`,
    html: meetingEmailHtml(
      updated,
      `This meeting has moved from ${from.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} to the time below.`
    ),
  });

  return updated;
}

async function cancelMeeting(id, actingUser) {
  const meeting = await getMeeting(id);
  const { team } = await loadClientAndTeam(toId(meeting.client));
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to cancel this meeting.");
  }

  const updated = await meetingRepository.updateById(id, {
    status: MEETING_STATUS.CANCELLED,
    cancelledAt: new Date(),
    cancelledBy: actingUser.id,
  });

  await notifyParticipants(updated, {
    type: NOTIFICATION_TYPES.MEETING_CANCELLED,
    title: 'Meeting cancelled',
    message: meetingDescriptor(updated),
  });
  await emailParticipants(updated, {
    subject: `Meeting cancelled — ${updated.client?.name || 'Client'}`,
    html: meetingEmailHtml(updated, 'This meeting has been cancelled.'),
  });

  return updated;
}

// Structured MOM — summary, present/absent (from the meeting's own
// participant list), decisions, action items. Marks the meeting completed
// if it wasn't already (covers a scheduled meeting whose time has passed).
async function submitMom(id, { summary, attendeesPresent, attendeesAbsent, decisions, actionItems }, actingUser) {
  const meeting = await getMeeting(id);
  const { team } = await loadClientAndTeam(toId(meeting.client));
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to write this meeting's MOM.");
  }
  if (meeting.status === MEETING_STATUS.CANCELLED) throw ApiError.badRequest('This meeting is cancelled.');

  return meetingRepository.updateById(id, {
    status: MEETING_STATUS.COMPLETED,
    mom: {
      summary,
      attendeesPresent: attendeesPresent || [],
      attendeesAbsent: attendeesAbsent || [],
      decisions: decisions || [],
      actionItems: actionItems || [],
      writtenBy: actingUser.id,
      writtenAt: new Date(),
    },
  });
}

// Validates + shapes the initial momPipeline sub-document for a new
// pipeline task — see EmployeeTask.js#momPipelineSchema.
function buildInitialMomPipeline(pipelineInput) {
  if (!pipelineInput?.kind) throw ApiError.badRequest('Choose a pipeline kind.');

  if (pipelineInput.kind === MOM_PIPELINE_KIND.CUSTOM) {
    const steps = pipelineInput.customSteps || [];
    if (steps.length < 2 || steps.length > 5) {
      throw ApiError.badRequest('A custom pipeline needs between 2 and 5 steps.');
    }
    for (const step of steps) {
      if (!step.label?.trim() || !step.color || !step.assignee) {
        throw ApiError.badRequest('Every custom step needs a label, a colour, and an assignee.');
      }
    }
    return {
      kind: MOM_PIPELINE_KIND.CUSTOM,
      stage: 'created',
      customSteps: steps.map((s, i) => ({ key: `step_${i + 1}`, label: s.label, color: s.color, assignee: s.assignee })),
    };
  }

  const assignments = pipelineInput.assignments || {};
  if (pipelineInput.kind === MOM_PIPELINE_KIND.REEL) {
    if (!assignments.shooter || !assignments.editor || !assignments.contentManager) {
      throw ApiError.badRequest('A reel needs videographer, editor, and content manager assigned.');
    }
  } else if (pipelineInput.kind === MOM_PIPELINE_KIND.POST) {
    if (!assignments.designer) throw ApiError.badRequest('A post needs one social media manager assigned.');
  } else {
    throw ApiError.badRequest(`Unknown pipeline kind "${pipelineInput.kind}".`);
  }

  return { kind: pipelineInput.kind, stage: 'created', assignments };
}

// The MOM's "any more tasks required?" step — Personal and Team reuse
// EmployeeTask's existing creation paths completely unchanged (task/team
// assignment, extraMembers for outside people); Pipeline creates a new,
// deliberately off-calendar `type:'client'` task carrying `momPipeline` —
// never a ClientCalendar/CalendarItem, no quota impact, no calendar-grid
// presence. Every kind gets snapshotted onto the meeting's `spawnedTasks[]`
// (title/description as originally written) alongside the live task ref.
async function addTaskFromMom(meetingId, input, actingUser) {
  const meeting = await getMeeting(meetingId);
  const { team } = await loadClientAndTeam(toId(meeting.client));
  if (!cmsAccess.canManageMeetings(actingUser, team)) {
    throw ApiError.forbidden("You don't have permission to create tasks for this meeting.");
  }

  const base = {
    title: input.title,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    meetingRef: meeting._id,
    reviewMandatory: Boolean(input.reviewMandatory),
  };

  let task;
  if (input.kind === MOM_TASK_KIND.PERSONAL) {
    if (!input.assigneeId) throw ApiError.badRequest('A personal task needs one assignee.');
    task = await employeeTaskService.createTask(
      { ...base, type: EMPLOYEE_TASK_TYPE.PERSONAL, assignedEmployees: [input.assigneeId] },
      actingUser.employeeLink || null
    );
  } else if (input.kind === MOM_TASK_KIND.TEAM) {
    if (!team) throw ApiError.badRequest('This client has no team assigned.');
    task = await employeeTaskService.createTask(
      { ...base, type: EMPLOYEE_TASK_TYPE.TEAM, team: toId(team), extraMembers: input.extraMembers || [] },
      actingUser.employeeLink || null
    );
  } else if (input.kind === MOM_TASK_KIND.PIPELINE) {
    if (!team) throw ApiError.badRequest('This client has no team assigned.');
    const momPipelineData = buildInitialMomPipeline(input.pipeline);
    task = await employeeTaskService.createTask(
      { ...base, type: EMPLOYEE_TASK_TYPE.CLIENT, team: toId(team), client: toId(meeting.client), momPipeline: momPipelineData },
      actingUser.employeeLink || null
    );
    await momPipelineService.createSubtasksFor(task, momPipelineData, actingUser);
  } else {
    throw ApiError.badRequest(`Unknown task kind "${input.kind}".`);
  }

  await meetingRepository.updateById(meetingId, {
    $push: {
      spawnedTasks: { task: task._id, titleSnapshot: task.title, descriptionSnapshot: task.description, kind: input.kind },
    },
  });

  return task;
}

module.exports = {
  meetingsFrom,
  loadClientAndTeam,
  listForClient,
  getMeeting,
  scheduleMeeting,
  logMeeting,
  rescheduleMeeting,
  cancelMeeting,
  submitMom,
  addTaskFromMom,
};
