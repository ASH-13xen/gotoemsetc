const { z } = require('zod');
const { EVENT_MODE, EVENT_RESPONSIBILITY_STATUS } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

const eventBodyBase = {
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  client: z.string().min(1).nullable().optional(),
  mode: z.enum(Object.values(EVENT_MODE)).optional(),
  location: z.string().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
  coordinator: z.string().min(1).nullable().optional(),
};

const createEvent = {
  body: z.object({ ...eventBodyBase, title: z.string().min(1), mode: z.enum(Object.values(EVENT_MODE)), startAt: z.coerce.date() }),
};

const updateEvent = {
  params: idParam,
  body: z.object(eventBodyBase),
};

const getOrDeleteEvent = { params: idParam };

const rescheduleEvent = {
  params: idParam,
  body: z.object({
    newStartAt: z.coerce.date(),
    newEndAt: z.coerce.date().optional(),
    note: z.string().optional(),
  }),
};

const fillSummary = {
  params: idParam,
  body: z.object({
    highlights: z.string().optional(),
    improvements: z.string().optional(),
  }),
};

const responsibilityBodyBase = {
  title: z.string().min(1).optional(),
  assignedEmployees: z.array(z.string().min(1)).optional(),
  assignedTeam: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  startTime: z.coerce.date().nullable().optional(),
  endTime: z.coerce.date().nullable().optional(),
};

const createResponsibility = {
  params: idParam,
  body: z.object({ ...responsibilityBodyBase, title: z.string().min(1) }),
};

const updateResponsibility = {
  params: idParam,
  body: z.object(responsibilityBodyBase),
};

const setResponsibilityStatus = {
  params: idParam,
  body: z.object({ status: z.enum(Object.values(EVENT_RESPONSIBILITY_STATUS)) }),
};

module.exports = {
  createEvent,
  updateEvent,
  getOrDeleteEvent,
  rescheduleEvent,
  fillSummary,
  createResponsibility,
  updateResponsibility,
  setResponsibilityStatus,
};
