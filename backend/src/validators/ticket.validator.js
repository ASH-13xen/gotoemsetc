const { z } = require('zod');
const { TICKET_PIPELINE, TICKET_PRIORITY, TICKET_REPEAT, WEEKLY_GRID } = require('../config/constants');

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const idParam = { params: z.object({ id }) };

const raise = {
  body: z
    .object({
      title: z.string().trim().min(1, 'Give the ticket a title').max(160),
      description: z.string().trim().max(5000).optional(),
      priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
      dueAt: z.coerce.date(),
      clientName: z.string().trim().max(120).optional(),
      pipeline: z.enum(Object.values(TICKET_PIPELINE)),
      // Raise a fresh copy every day/week/month/year until it's stopped.
      repeat: z.enum(['none', ...Object.values(TICKET_REPEAT)]).optional(),
      raisedFor: id.optional(),
      team: id.optional(),
      // Story/Post/Reel: the team's Social Media Manager it is for.
      smm: id.optional(),
      assignments: z
        .object({ designer: id.optional(), shooter: id.optional(), editor: id.optional(), contentManager: id.optional() })
        .optional(),
      customSteps: z
        .array(z.object({ label: z.string().trim().min(1).max(60), color: z.string().trim(), assignee: id }))
        .optional(),
    })
    .superRefine((d, ctx) => {
      if (d.pipeline === TICKET_PIPELINE.SIMPLE && !d.raisedFor) {
        ctx.addIssue({ code: 'custom', path: ['raisedFor'], message: 'Choose who this ticket is for' });
      }
      if (d.pipeline === TICKET_PIPELINE.STORY && !d.raisedFor && !d.smm) {
        ctx.addIssue({ code: 'custom', path: ['smm'], message: 'Choose the Social Media Manager it is for' });
      }
    }),
};

const list = {
  query: z.object({
    scope: z.enum(['mine', 'raised', 'team', 'all', 'submitted']).optional(),
    status: z.enum(['open', 'completed', 'rejected', 'all', 'unreviewed', 'reviewed']).optional(),
    q: z.string().trim().max(100).optional(),
  }),
};

const calendarList = {
  query: z.object({
    scope: z.enum(['mine', 'team', 'all']).optional(),
    status: z.enum(['open', 'completed', 'rejected', 'all']).optional(),
  }),
};

const note = { ...idParam, body: z.object({ note: z.string().trim().max(2000).optional() }) };
const requiredNote = { ...idParam, body: z.object({ note: z.string().trim().min(1, 'Say why').max(2000) }) };
const reason = { ...idParam, body: z.object({ reason: z.string().trim().min(1, 'A reason is required').max(2000) }) };

const edit = {
  ...idParam,
  body: z.object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: z.enum(Object.values(TICKET_PRIORITY)).optional(),
    clientName: z.string().trim().max(120).optional(),
    dueAt: z.coerce.date().optional(),
    note: z.string().trim().max(2000).optional(),
  }),
};

const reassign = {
  ...idParam,
  body: z.object({
    field: z.enum(['designer', 'shooter', 'editor', 'contentManager']).optional(),
    stepKey: z.string().trim().optional(),
    employeeId: id,
    note: z.string().trim().max(2000).optional(),
  }),
};

const comment = { ...idParam, body: z.object({ text: z.string().trim().min(1).max(5000) }) };
const link = { ...idParam, body: z.object({ url: z.string().trim().url('Enter a full link, starting with https://'), label: z.string().trim().max(120).optional() }) };

const analysis = {
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    pipeline: z.enum(Object.values(TICKET_PIPELINE)).optional(),
    team: id.optional(),
    person: id.optional(),
  }),
};

// The calendar's own send-back takes an optional note; tickets show it the
// same way.
const calendarDecision = { ...idParam, body: z.object({ note: z.string().trim().max(2000).optional() }) };

// Planned ticket work on the Weekly Calendar (ticketPlan.service.js): whole
// 5-minute steps inside the calendar's day, at least 15 minutes.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid day');
const minute = z.number().int().min(WEEKLY_GRID.START).max(WEEKLY_GRID.END).refine((m) => m % 5 === 0, 'Use 5-minute steps');
const planTimes = (d, ctx) => {
  if (d.startMin !== undefined && d.endMin !== undefined && d.endMin - d.startMin < 15) {
    ctx.addIssue({ code: 'custom', path: ['endMin'], message: 'Plan at least 15 minutes' });
  }
};
const planList = {
  query: z
    .object({ from: day, to: day })
    .refine((q) => q.to >= q.from && Date.parse(q.to) - Date.parse(q.from) <= 62 * 86400000, { message: 'Pick a range of up to 62 days' }),
};
const planCreate = {
  body: z
    .object({ kind: z.enum(['ticket', 'calendar', 'stories']), ref: id, day, startMin: minute, endMin: minute })
    .superRefine(planTimes),
};
const planUpdate = {
  params: z.object({ id }),
  body: z.object({ day: day.optional(), startMin: minute.optional(), endMin: minute.optional() }).superRefine(planTimes),
};

// The Task Calendar — a month (with its edge weeks) at most.
const taskCalendar = {
  query: z
    .object({ from: z.coerce.date(), to: z.coerce.date() })
    .refine((q) => q.to >= q.from && q.to - q.from <= 62 * 86400000, { message: 'Pick a range of up to 62 days' }),
};

module.exports = {
  planList,
  planCreate,
  planUpdate,
  stopRepeat: { params: z.object({ id }), body: z.object({ reason: z.string().trim().max(300).optional() }) }, idParam, taskCalendar, raise, list, calendarList, note, requiredNote, reason, edit, reassign, comment, link, analysis, calendarDecision };
