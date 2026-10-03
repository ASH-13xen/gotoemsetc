const { z } = require('zod');
const { WEEKLY_EVENT_CATEGORY, WEEKLY_NOTE_KIND } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const minute = z.number().int().min(0).max(24 * 60);
const scope = z.enum(['one', 'series']).optional();
const idParam = { params: z.object({ id: objectId }) };
const optionalText = (max) => z.string().trim().max(max).optional();
const link = z.union([z.string().trim().url('Enter a full link, e.g. https://meet.google.com/…').max(500), z.literal('')]).optional();

const week = {
  query: z.object({ start: day.optional(), user: objectId.optional() }),
};

const busy = {
  query: z.object({
    start: day.optional(),
    users: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : undefined))
      .pipe(z.array(objectId).max(200).optional()),
  }),
};

const createEvent = {
  body: z.object({
    title: z.string().trim().min(1, 'Give it a title').max(120),
    description: optionalText(2000),
    category: z.enum(Object.values(WEEKLY_EVENT_CATEGORY)).default(WEEKLY_EVENT_CATEGORY.OTHER),
    isPersonal: z.boolean().optional(),
    openForAll: z.boolean().optional(),
    location: optionalText(200),
    link,
    slots: z
      .array(z.object({ day, startMin: minute, endMin: minute }))
      .min(1, 'Pick at least one slot')
      .max(14),
    repeatWeeks: z.number().int().min(0).max(12).optional(),
    invitees: z.array(objectId).max(200).optional(),
  }),
};

const updateEvent = {
  ...idParam,
  body: z.object({
    title: z.string().trim().min(1).max(120).optional(),
    description: optionalText(2000),
    category: z.enum(Object.values(WEEKLY_EVENT_CATEGORY)).optional(),
    openForAll: z.boolean().optional(),
    location: optionalText(200),
    link,
    day: day.optional(),
    startMin: minute.optional(),
    endMin: minute.optional(),
    scope,
  }),
};

const cancelEvent = { ...idParam, body: z.object({ scope, reason: optionalText(300) }) };
const invite = { ...idParam, body: z.object({ userIds: z.array(objectId).min(1).max(200), scope }) };
const removeAttendee = { params: z.object({ id: objectId, userId: objectId }), query: z.object({ scope }) };
const respond = {
  ...idParam,
  body: z.object({ response: z.enum(['accept', 'decline']), reason: optionalText(300), scope }),
};

const segments = {
  ...idParam,
  body: z.object({
    segments: z
      .array(z.object({ startMin: minute, endMin: minute, label: optionalText(80), user: objectId.nullable().optional() }))
      .max(40),
  }),
};

const addNote = {
  ...idParam,
  body: z.object({
    kind: z.enum(Object.values(WEEKLY_NOTE_KIND)).optional(),
    text: z.string().trim().min(1, 'Write something first').max(4000),
    assignee: objectId.optional(),
    dueDay: day.optional(),
  }),
};

const noteParams = { params: z.object({ id: objectId, noteId: objectId }) };
const updateNote = {
  ...noteParams,
  body: z.object({
    text: z.string().trim().min(1).max(4000).optional(),
    done: z.boolean().optional(),
    assignee: objectId.nullable().optional(),
    dueDay: day.nullable().optional(),
  }),
};

const copyWeek = { body: z.object({ from: day, to: day }) };

const publicToken = { params: z.object({ token: z.string().min(20).max(2000) }) };
const publicRespond = {
  ...publicToken,
  body: z.object({ response: z.enum(['accept', 'decline']), reason: optionalText(300) }),
};

module.exports = {
  week,
  busy,
  idParam,
  createEvent,
  updateEvent,
  cancelEvent,
  invite,
  removeAttendee,
  respond,
  segments,
  addNote,
  noteParams,
  updateNote,
  copyWeek,
  publicToken,
  publicRespond,
};
