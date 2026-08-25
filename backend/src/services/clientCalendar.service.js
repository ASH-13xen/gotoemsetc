const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const clientCalendarRepository = require('../repositories/clientCalendar.repository');
const calendarItemRepository = require('../repositories/calendarItem.repository');
const taskClientRepository = require('../repositories/taskClient.repository');
const employeeTaskRepository = require('../repositories/employeeTask.repository');
const workTeamRepository = require('../repositories/workTeam.repository');
const calendarItemService = require('./calendarItem.service');
const cmsWorkflow = require('./cmsWorkflow.service');
const cmsAccess = require('../utils/cmsAccess');
const istDate = require('../utils/istDate');
const {
  CMS_PLAN_QUOTAS,
  CMS_CONTENT_TYPE,
  CMS_CONTENT_TYPE_QUOTA_KEY,
} = require('../config/constants');

// Creates the month a client's plan is committed and reported against.
// Explicit by design: no calendar for a month means no content is owed that
// month, including no daily stories. Nothing auto-creates one.
async function createCalendar({ clientId, year, month, plan, teamId, generateDailyStories = true }, actingUser) {
  const client = await taskClientRepository.findById(clientId);
  if (!client) throw ApiError.notFound('Client not found');

  const existing = await clientCalendarRepository.findForClientMonth(clientId, year, month);
  if (existing) {
    throw ApiError.conflict(`A calendar for ${year}-${String(month).padStart(2, '0')} already exists for this client.`);
  }

  // Explicit arguments win, but both fall back to the client's current
  // setting — and both are then frozen, so changing the client's plan or
  // team later never rewrites a month already committed.
  const resolvedPlan = plan || client.currentPlan;
  if (!resolvedPlan) {
    throw ApiError.badRequest('Select a plan for this client before creating a calendar.');
  }

  const resolvedTeamId = teamId || cmsAccess.toId(client.defaultTeam);
  if (!resolvedTeamId) {
    throw ApiError.badRequest('Assign a team to this client before creating a calendar.');
  }
  const team = await workTeamRepository.findById(resolvedTeamId);
  if (!team) throw ApiError.notFound('Team not found');

  const created = await clientCalendarRepository.create({
    client: clientId,
    year,
    month,
    plan: resolvedPlan,
    quotas: CMS_PLAN_QUOTAS[resolvedPlan],
    team: resolvedTeamId,
    createdBy: actingUser.employeeLink || null,
  });

  const calendar = await clientCalendarRepository.findById(created._id);

  if (generateDailyStories) {
    // Best-effort: a calendar with no stories yet is recoverable (they can be
    // added by hand), a half-created calendar is not.
    try {
      await generateDailyStoriesForMonth(calendar, team, actingUser);
    } catch (err) {
      logger.error({ err, calendarId: calendar._id }, 'Daily story generation failed');
    }
  }

  return clientCalendarRepository.findById(created._id);
}

// One story item per day of the month, not one per story. The plan commits a
// *rate* ("1/day", "2-3/day"), and the spec calls daily stories "the daily
// task" — so a day is the unit of work, and the day's expected count rides
// along as the quota label rather than fragmenting into separate items.
// Diamond would otherwise mean 90 tasks a month for one person, per client.
//
// Routed to every team member currently tagged Social Media Manager,
// collectively — any of them may complete a given day (see
// calendarItem.service.js#subtaskPlan, which also falls back to Team Main
// if nobody's tagged yet).
async function generateDailyStoriesForMonth(calendar, team, actingUser) {
  const days = istDate.istDaysInMonth(calendar.year, calendar.month);
  const created = [];

  for (let day = 1; day <= days; day++) {
    const scheduledDate = istDate.istInstant(calendar.year, calendar.month, day, 18, 30);
    const item = await calendarItemService.scheduleItem(
      calendar,
      { type: CMS_CONTENT_TYPE.STORY, scheduledDate },
      actingUser,
      { team }
    );
    created.push(item);
  }

  return created;
}

async function getCalendar(id) {
  const calendar = await clientCalendarRepository.findById(id);
  if (!calendar) throw ApiError.notFound('Calendar not found');
  return calendar;
}

async function getForClientMonth(clientId, year, month) {
  return clientCalendarRepository.findForClientMonth(clientId, year, month);
}

function listForClient(clientId) {
  return clientCalendarRepository.listForClient(clientId);
}

// The calendar plus everything needed to render a month in one request:
// items grouped by IST day, with their heading and colour resolved, and the
// sidebar counters.
async function getCalendarView(id) {
  const calendar = await getCalendar(id);
  const items = await calendarItemRepository.listForCalendar(calendar._id);
  const now = new Date();

  const decorated = items.map((item) => ({
    ...item.toObject(),
    label: cmsWorkflow.labelFor(item),
    color: cmsWorkflow.colorFor(item, now),
    trail: cmsWorkflow.stepTrail(item),
    dateKey: istDate.istDateKey(item.scheduledDate),
  }));

  const byDate = decorated.reduce((acc, item) => {
    (acc[item.dateKey] = acc[item.dateKey] || []).push(item);
    return acc;
  }, {});

  return {
    calendar,
    items: decorated,
    byDate,
    counters: buildCounters(calendar, decorated),
    daysInMonth: istDate.istDaysInMonth(calendar.year, calendar.month),
  };
}

// Two numbers per content type, because "scheduled" and "delivered" answer
// different questions — a month where everything is scheduled and nothing is
// finished must not read as complete. Denominators are the plan's label
// strings verbatim ("6-8"), never resolved to a number; numerators are
// integers and may legitimately exceed them (7/6-8 is over-delivery).
//
// Daily stories are counted in days covered rather than against a monthly
// total, since their quota is a per-day rate.
function buildCounters(calendar, items) {
  const live = items.filter((i) => !i.isDeleted);

  const counters = {};
  for (const type of Object.values(CMS_CONTENT_TYPE)) {
    const ofType = live.filter((i) => i.type === type);
    const quotaKey = CMS_CONTENT_TYPE_QUOTA_KEY[type];
    const quota = calendar.quotas[quotaKey];

    if (type === CMS_CONTENT_TYPE.STORY) {
      const daysInMonth = istDate.istDaysInMonth(calendar.year, calendar.month);
      const coveredDays = new Set(ofType.map((i) => i.dateKey)).size;
      const publishedDays = new Set(
        ofType.filter((i) => cmsWorkflow.isTerminal(i)).map((i) => i.dateKey)
      ).size;
      counters[type] = {
        perDayLabel: quota.label,
        scheduled: coveredDays,
        delivered: publishedDays,
        denominator: String(daysInMonth),
        unit: 'days',
      };
      continue;
    }

    counters[type] = {
      scheduled: ofType.length,
      delivered: ofType.filter((i) => cmsWorkflow.isTerminal(i)).length,
      denominator: quota.label,
      unit: 'items',
    };
  }

  return counters;
}

// Changing the team mid-month re-points the calendar but deliberately leaves
// already-created tasks with their original team — reassigning work someone
// has started is a decision for a human, not a side effect of this edit.
async function updateCalendar(id, data) {
  const calendar = await clientCalendarRepository.updateById(id, data);
  if (!calendar) throw ApiError.notFound('Calendar not found');
  return calendar;
}

// Soft-deletes the month and every item in it, each of which cascades to its
// own task tree — see calendarItemService.deleteItem.
async function deleteCalendar(id) {
  const items = await calendarItemRepository.listForCalendar(id);
  for (const item of items) {
    await calendarItemService.deleteItem(item._id);
  }

  // The shared daily-story parent belongs to the month, not to any item, so
  // it survives the per-item cascade above and has to be retired here.
  const existing = await clientCalendarRepository.findById(id);
  if (existing?.dailyStoryTask) {
    await employeeTaskRepository
      .softDeleteById(cmsAccess.toId(existing.dailyStoryTask))
      .catch((err) => logger.error({ err }, 'Failed to soft-delete shared daily-story task'));
  }

  const calendar = await clientCalendarRepository.softDeleteById(id);
  if (!calendar) throw ApiError.notFound('Calendar not found');
  return calendar;
}

module.exports = {
  createCalendar,
  generateDailyStoriesForMonth,
  getCalendar,
  getForClientMonth,
  listForClient,
  getCalendarView,
  buildCounters,
  updateCalendar,
  deleteCalendar,
};
