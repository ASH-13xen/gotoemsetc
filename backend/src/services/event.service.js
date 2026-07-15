const ApiError = require('../utils/ApiError');
const eventRepository = require('../repositories/event.repository');
const eventResponsibilityRepository = require('../repositories/eventResponsibility.repository');
const teamRepository = require('../repositories/team.repository');
const eventNotify = require('./eventNotify.service');
const { EVENT_STATUS } = require('../config/constants');

async function listEvents() {
  return eventRepository.list();
}

async function getEvent(id) {
  const event = await eventRepository.findById(id);
  if (!event) throw ApiError.notFound('Event not found');
  const responsibilities = await eventResponsibilityRepository.listForEvent(id);
  return { event, responsibilities };
}

// Open to any employee, not just admin — "the admin or employee can create
// a new event."
async function createEvent(data, actingEmployeeId) {
  return eventRepository.create({ ...data, createdBy: actingEmployeeId || undefined });
}

async function updateEvent(id, patch) {
  const event = await eventRepository.updateById(id, patch);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

// Postpone or prepone — logs the change rather than silently overwriting
// startAt, so the event keeps a visible reschedule trail.
async function rescheduleEvent(id, { newStartAt, newEndAt, note }, actingEmployeeId) {
  const event = await eventRepository.findRaw(id);
  if (!event) throw ApiError.notFound('Event not found');

  const entry = {
    fromStartAt: event.startAt,
    toStartAt: new Date(newStartAt),
    note,
    changedBy: actingEmployeeId || undefined,
    changedAt: new Date(),
  };

  const setFields = { startAt: newStartAt };
  if (newEndAt !== undefined) setFields.endAt = newEndAt;

  // $set and $push mixed with plain fields in one update object is invalid
  // for MongoDB — spell both operators out explicitly rather than relying
  // on Mongoose's auto-wrapping.
  return eventRepository.updateById(id, { $set: setFields, $push: { rescheduleHistory: entry } });
}

async function markCompleted(id) {
  const event = await eventRepository.updateById(id, { status: EVENT_STATUS.COMPLETED });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function markCancelled(id) {
  const event = await eventRepository.updateById(id, { status: EVENT_STATUS.CANCELLED });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

// Admin-only, per the product ask — visible to every employee once filled
// (events carry no access gating, unlike Task Management's clients).
async function fillSummary(id, { highlights, improvements }, actingEmployeeId) {
  const event = await eventRepository.updateById(id, {
    summary: { highlights, improvements, filledBy: actingEmployeeId || undefined, filledAt: new Date() },
  });
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function deleteEvent(id) {
  const event = await eventRepository.softDeleteById(id);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

async function createResponsibility(eventId, data) {
  const event = await eventRepository.findRaw(eventId);
  if (!event) throw ApiError.notFound('Event not found');

  const responsibility = await eventResponsibilityRepository.create({ ...data, event: eventId });
  await eventNotify.notifyResponsibilityAssignment(responsibility, event);
  return eventResponsibilityRepository.findById(responsibility._id);
}

async function updateResponsibility(id, patch) {
  const responsibility = await eventResponsibilityRepository.updateById(id, patch);
  if (!responsibility) throw ApiError.notFound('Responsibility not found');

  if (patch.assignedEmployees !== undefined || patch.assignedTeam !== undefined) {
    const event = await eventRepository.findRaw(responsibility.event);
    if (event) await eventNotify.notifyResponsibilityAssignment(responsibility, event);
  }
  return responsibility;
}

async function setResponsibilityStatus(id, status, actingEmployeeId) {
  const patch = { status };
  if (status === 'done') {
    patch.completedBy = actingEmployeeId || undefined;
    patch.completedAt = new Date();
  } else {
    patch.completedBy = undefined;
    patch.completedAt = undefined;
  }
  const responsibility = await eventResponsibilityRepository.updateById(id, patch);
  if (!responsibility) throw ApiError.notFound('Responsibility not found');
  return responsibility;
}

async function deleteResponsibility(id) {
  const responsibility = await eventResponsibilityRepository.softDeleteById(id);
  if (!responsibility) throw ApiError.notFound('Responsibility not found');
  return responsibility;
}

// "Due tasks" feed for an employee's Event Management view and the shell
// dashboard widget — everything assigned to them directly or via a team
// they're on, still pending.
async function listMyResponsibilities(employeeId) {
  if (!employeeId) return [];
  const teams = await teamRepository.listForMember(employeeId);
  const all = await eventResponsibilityRepository.listForEmployeeOrTeams(employeeId, teams.map((t) => t._id));
  return all.filter((r) => r.status !== 'done');
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  rescheduleEvent,
  markCompleted,
  markCancelled,
  fillSummary,
  deleteEvent,
  createResponsibility,
  updateResponsibility,
  setResponsibilityStatus,
  deleteResponsibility,
  listMyResponsibilities,
};
