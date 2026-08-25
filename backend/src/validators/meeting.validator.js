const { z } = require('zod');
const { MEETING_TYPE, MOM_TASK_KIND, MOM_PIPELINE_KIND } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };
const clientIdParam = { params: z.object({ clientId: z.string().min(1) }) };

const scheduleBody = {
  clientId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  meetingType: z.enum(Object.values(MEETING_TYPE)),
  location: z.string().trim().optional(),
  meetingLink: z.string().trim().optional(),
  participants: z.array(z.string().min(1)).min(1, 'At least one participant is required'),
};

const schedule = { body: z.object(scheduleBody) };
const log = { body: z.object(scheduleBody) };

const reschedule = { ...idParam, body: z.object({ scheduledAt: z.coerce.date() }) };
const cancel = { ...idParam };

const submitMom = {
  ...idParam,
  body: z.object({
    summary: z.string().trim().optional(),
    attendeesPresent: z.array(z.string().min(1)).optional(),
    attendeesAbsent: z.array(z.string().min(1)).optional(),
    decisions: z.array(z.string().trim()).optional(),
    actionItems: z.array(z.string().trim()).optional(),
  }),
};

const getOrDelete = { ...idParam };

// The MOM's "any more tasks required?" step — see meeting.service.js#
// addTaskFromMom for the full permutation matrix this backs.
const customStep = z.object({
  label: z.string().trim().min(1),
  color: z.string().trim().min(1),
  assignee: z.string().min(1),
});

const pipelineInput = z.object({
  kind: z.enum(Object.values(MOM_PIPELINE_KIND)),
  assignments: z
    .object({
      designer: z.string().min(1).optional(),
      shooter: z.string().min(1).optional(),
      editor: z.string().min(1).optional(),
      contentManager: z.string().min(1).optional(),
    })
    .optional(),
  customSteps: z.array(customStep).optional(),
});

const addTask = {
  ...idParam,
  body: z.object({
    kind: z.enum(Object.values(MOM_TASK_KIND)),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reviewMandatory: z.boolean().optional(),
    assigneeId: z.string().min(1).optional(), // personal
    extraMembers: z.array(z.string().min(1)).optional(), // team
    pipeline: pipelineInput.optional(), // pipeline
  }),
};

module.exports = { clientIdParam, schedule, log, reschedule, cancel, submitMom, addTask, getOrDelete };
