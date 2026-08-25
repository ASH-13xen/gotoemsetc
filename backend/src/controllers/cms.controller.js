const asyncHandler = require('../utils/asyncHandler');
const clientCalendarService = require('../services/clientCalendar.service');
const calendarItemService = require('../services/calendarItem.service');
const cmsReportService = require('../services/cmsReport.service');

const createCalendar = asyncHandler(async (req, res) => {
  const calendar = await clientCalendarService.createCalendar(
    {
      clientId: req.body.client,
      year: req.body.year,
      month: req.body.month,
      plan: req.body.plan,
      teamId: req.body.team,
      generateDailyStories: req.body.generateDailyStories,
    },
    req.user
  );
  req.auditContext = {
    action: 'cms.calendar.create',
    resourceType: 'ClientCalendar',
    resourceId: calendar._id,
    metadata: { client: req.body.client, year: req.body.year, month: req.body.month, plan: calendar.plan },
  };
  res.status(201).json({ calendar });
});

const listCalendars = asyncHandler(async (req, res) => {
  const calendars = await clientCalendarService.listForClient(req.query.client);
  res.json({ calendars });
});

// The whole month in one request — items grouped by IST day with their
// heading and colour resolved, plus the sidebar counters.
const getCalendarView = asyncHandler(async (req, res) => {
  const view = await clientCalendarService.getCalendarView(req.params.id);
  res.json(view);
});

const updateCalendar = asyncHandler(async (req, res) => {
  const calendar = await clientCalendarService.updateCalendar(req.params.id, req.body);
  req.auditContext = {
    action: 'cms.calendar.update',
    resourceType: 'ClientCalendar',
    resourceId: calendar._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ calendar });
});

const deleteCalendar = asyncHandler(async (req, res) => {
  await clientCalendarService.deleteCalendar(req.params.id);
  req.auditContext = {
    action: 'cms.calendar.delete',
    resourceType: 'ClientCalendar',
    resourceId: req.params.id,
  };
  res.status(204).send();
});

const scheduleItem = asyncHandler(async (req, res) => {
  // req.calendar is loaded and access-checked by requireCanScheduleForCalendar.
  const item = await calendarItemService.scheduleItem(req.calendar, req.body, req.user);
  req.auditContext = {
    action: 'cms.item.schedule',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { type: item.type, index: item.index, scheduledDate: item.scheduledDate },
  };
  res.status(201).json({ item });
});

// Decorated (label/colour/step-trail resolved server-side) — this is also
// what frontendfollowups' Task Management calls for a client task's linked
// item, to render the pipeline stepper on the task detail page.
const getItem = asyncHandler(async (req, res) => {
  const item = await calendarItemService.getItemView(req.params.id);
  res.json({ item });
});

const updateBrief = asyncHandler(async (req, res) => {
  const item = await calendarItemService.updateBrief(req.params.id, req.body);
  res.json({ item });
});

const reschedule = asyncHandler(async (req, res) => {
  const item = await calendarItemService.reschedule(req.params.id, req.body.scheduledDate);
  req.auditContext = {
    action: 'cms.item.reschedule',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { scheduledDate: item.scheduledDate },
  };
  res.json({ item });
});

const reassign = asyncHandler(async (req, res) => {
  const item = await calendarItemService.reassign(req.params.id, req.body);
  req.auditContext = {
    action: 'cms.item.reassign',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { fields: Object.keys(req.body) },
  };
  res.json({ item });
});

const deleteItem = asyncHandler(async (req, res) => {
  await calendarItemService.deleteItem(req.params.id);
  req.auditContext = {
    action: 'cms.item.delete',
    resourceType: 'CalendarItem',
    resourceId: req.params.id,
  };
  res.status(204).send();
});

// The current step's actor marks it done — drives the whole pipeline.
const advance = asyncHandler(async (req, res) => {
  const item = await calendarItemService.advance(req.params.id, req.user, req.body);
  req.auditContext = {
    action: 'cms.item.advance',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { stage: item.stage },
  };
  res.json({ item });
});

// Pink — sends the item back one step.
const sendBack = asyncHandler(async (req, res) => {
  const item = await calendarItemService.sendBack(req.params.id, req.user, req.body);
  req.auditContext = {
    action: 'cms.item.sendBack',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { stage: item.stage },
  };
  res.json({ item });
});

// Red — terminal, closes the item for everyone.
const reject = asyncHandler(async (req, res) => {
  const item = await calendarItemService.reject(req.params.id, req.user, req.body);
  req.auditContext = {
    action: 'cms.item.reject',
    resourceType: 'CalendarItem',
    resourceId: item._id,
    metadata: { stage: item.stage },
  };
  res.json({ item });
});

const getReport = asyncHandler(async (req, res) => {
  const report = await cmsReportService.getOrBuildReport(req.params.id);
  res.json({ report });
});

const closeMonth = asyncHandler(async (req, res) => {
  const calendar = await cmsReportService.closeMonth(req.params.id);
  req.auditContext = {
    action: 'cms.calendar.close',
    resourceType: 'ClientCalendar',
    resourceId: calendar._id,
  };
  res.json({ calendar });
});

module.exports = {
  createCalendar,
  listCalendars,
  getCalendarView,
  updateCalendar,
  deleteCalendar,
  scheduleItem,
  getItem,
  updateBrief,
  reschedule,
  reassign,
  deleteItem,
  advance,
  sendBack,
  reject,
  getReport,
  closeMonth,
};
