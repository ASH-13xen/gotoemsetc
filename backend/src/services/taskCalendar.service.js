const Ticket = require('../models/Ticket');
const CalendarItem = require('../models/CalendarItem');
const Employee = require('../models/Employee');
const org = require('./orgHierarchy.service');
const ticketService = require('./ticket.service');
const calendarTickets = require('./calendarTickets.service');
const pipe = require('../utils/ticketPipeline');
const cmsWorkflow = require('./cmsWorkflow.service');
const { CMS_CONTENT_TYPE, TICKET_STATUS } = require('../config/constants');

// The Task Calendar: every ticket on its due day, and the content calendar's
// work on its scheduled day, each in its current colour. The CEO and admin
// see everything; everyone else sees the tickets they raised or hold a step
// in, and the calendar work whose pipeline they are on.

const idOf = org.idOf;
const nameOf = (e) => (e ? `${e.firstName} ${e.lastName || ''}`.trim() : null);

// Everyone holding a step in a ticket's pipeline (and who it's for).
async function ticketPipelinePeople(ticket, chart) {
  const employeeIds = new Set([idOf(ticket.raisedFor)]);
  const userIds = new Set();
  for (const step of pipe.stepsFor(ticket)) {
    if (!step.actor) continue;
    // eslint-disable-next-line no-await-in-loop
    const a = await ticketService.actorsFor(ticket, step, chart);
    a.employeeIds.forEach((id) => employeeIds.add(id));
    a.userIds.forEach((id) => userIds.add(id));
  }
  return { employeeIds: [...employeeIds], userIds: [...userIds] };
}

async function entries(user, { from, to }) {
  const chart = await org.loadChart();
  const everyone = org.seesEveryone(user);
  const now = new Date();
  const out = [];

  // ---- tickets, on their due day ----
  const tickets = await Ticket.find({ dueAt: { $gte: from, $lte: to } }).sort({ dueAt: 1 });
  const people = new Map(
    (await Employee.find({ _id: { $in: tickets.map((t) => t.raisedFor) } }).select('firstName lastName').lean()).map((e) => [idOf(e._id), nameOf(e)])
  );
  for (const t of tickets) {
    /* eslint-disable no-await-in-loop */
    const raisedByMe = idOf(t.raisedBy) === idOf(user.id);
    const onPipeline = calendarTickets.isIn(user, await ticketPipelinePeople(t, chart));
    if (!everyone && !raisedByMe && !onPipeline) continue;
    const ctx = t.status === TICKET_STATUS.OPEN ? await ticketService.actingContext(user, t, chart) : { canAct: false };
    /* eslint-enable no-await-in-loop */
    const open = t.status === TICKET_STATUS.OPEN;
    out.push({
      kind: 'ticket',
      _id: idOf(t._id),
      code: ticketService.codeOf(t.number),
      title: t.title,
      at: t.dueAt,
      color: pipe.colorFor(t, now),
      stageLabel: t.isRejected ? 'Rejected' : pipe.stepLabel(t, t.stage),
      nextStepLabel: open ? pipe.stepLabel(t, pipe.nextStep(t)?.key) : null,
      pipelineName: { simple: 'Simple', story: 'Story', post: 'Post', reel: 'Reel', custom: 'Custom' }[t.pipeline],
      status: t.status,
      priority: t.priority,
      isOverdue: open && new Date(t.dueAt) < now,
      isSentBack: Boolean(t.isSentBack),
      raisedFor: people.get(idOf(t.raisedFor)) || null,
      team: t.teamName || null,
      clientName: t.clientName || null,
      createdAt: t.createdAt,
      completedAt: t.completedAt || null,
      // Why this person sees it.
      mine: { raised: raisedByMe, onPipeline, waitingOnMe: Boolean(ctx.canAct && ctx.natural) },
      link: `/followups/tickets/${idOf(t._id)}`,
    });
  }

  // ---- the content calendar's work, on its scheduled day ----
  const calendars = await calendarTickets.loadCalendars();
  if (calendars.size) {
    const items = await CalendarItem.find({ isDeleted: false, calendar: { $in: [...calendars.keys()] }, scheduledDate: { $gte: from, $lte: to } })
      .sort({ scheduledDate: 1 })
      .lean();
    for (const item of items) {
      const calendar = calendars.get(idOf(item.calendar));
      const teamBox = calendarTickets.teamBoxFor(chart, calendar);
      /* eslint-disable no-await-in-loop */
      const onPipeline = calendarTickets.isIn(user, await calendarTickets.pipelinePeople(item, teamBox, chart));
      if (!everyone && !onPipeline) continue;
      const waiting = await calendarTickets.waitingOn(item, teamBox, chart);
      /* eslint-enable no-await-in-loop */
      const open = calendarTickets.isOpenItem(item);
      const next = cmsWorkflow.nextStepConfig(item);
      const story = item.type === CMS_CONTENT_TYPE.STORY;
      out.push({
        kind: story ? 'story' : 'calendar',
        _id: idOf(item._id),
        code: story ? `${calendarTickets.codeFor(calendar)}` : calendarTickets.codeFor(calendar, item),
        title: `${story ? 'Daily story' : cmsWorkflow.labelFor(item)} · ${calendar.client?.name || 'Client'}`,
        at: item.scheduledDate,
        color: cmsWorkflow.colorFor(item, now),
        stageLabel: item.isRejected ? 'Rejected' : calendarTickets.labelFor(item, item.stage),
        nextStepLabel: open && next ? calendarTickets.labelFor(item, next.key) : null,
        pipelineName: story ? 'Story' : cmsWorkflow.pipelineKindFor(item),
        status: item.isRejected ? 'rejected' : open ? 'open' : 'completed',
        isOverdue: open && new Date(item.scheduledDate) < now,
        isSentBack: Boolean(item.isSentBack),
        team: teamBox?.title || null,
        clientName: calendar.client?.name || null,
        mine: { raised: false, onPipeline, waitingOnMe: calendarTickets.isIn(user, waiting) },
        link: story ? `/followups/calendar/stories/${idOf(calendar._id)}` : `/followups/calendar/items/${idOf(item._id)}`,
      });
    }
  }

  out.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { seesEveryone: everyone, entries: out };
}

module.exports = { entries };
