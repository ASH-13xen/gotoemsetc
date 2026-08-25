const { z } = require('zod');
const { EMPLOYEE_TASK_TYPE } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

// MOM-pipeline actions on a task — see momPipeline.service.js.
const momPipelineDecision = { ...idParam, body: z.object({ note: z.string().trim().optional() }) };
const momPipelineReject = { ...idParam, body: z.object({ reason: z.string().trim().min(1) }) };

const resourceRequiredSchema = z.object({
  label: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});

const contactRequiredSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
});

const followUpSchema = z.object({
  note: z.string().trim().optional(),
  followUpAt: z.coerce.date(),
});

const typeEnum = z.enum(Object.values(EMPLOYEE_TASK_TYPE));

const mutableFields = {
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  assignedEmployees: z.array(z.string().min(1)).optional(),
  team: z.string().min(1).optional(),
  extraMembers: z.array(z.string().min(1)).optional(),
  client: z.string().min(1).optional(),
  event: z.string().min(1).optional(),
  resourcesRequired: z.array(resourceRequiredSchema).optional(),
  contactsRequired: z.array(contactRequiredSchema).optional(),
  followUps: z.array(followUpSchema).optional(),
  // Off by default — see EmployeeTask.js.
  reviewMandatory: z.boolean().optional(),
  // Where the finished work lives, recorded by whoever did it. A link, not
  // an upload — see EmployeeTask.js.
  deliverableLink: z.string().trim().optional(),
};

// Every type has a different required shape — enforced once here rather
// than trusted to the frontend, since the service strips/normalizes based
// on `type` regardless.
function assertShapeForType(data, ctx) {
  if (data.endAt && data.startAt && data.endAt < data.startAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'End must be on or after start' });
  }

  if (data.type === EMPLOYEE_TASK_TYPE.PERSONAL) {
    if (!data.assignedEmployees || data.assignedEmployees.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedEmployees'],
        message: 'Personal tasks need exactly one assigned employee',
      });
    }
    return;
  }

  if (!data.team) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['team'], message: 'Team is required for this task type' });
  }
  if (data.type === EMPLOYEE_TASK_TYPE.CLIENT && !data.client) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['client'], message: 'Client is required' });
  }
  if (data.type === EMPLOYEE_TASK_TYPE.EVENT && !data.event) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['event'], message: 'Event is required' });
  }
}

const create = {
  body: z.object({ ...mutableFields, type: typeEnum }).superRefine(assertShapeForType),
};

// type is immutable once created — editing assignment/team/client/event
// after the fact is still allowed, just without re-checking the full
// type-shape invariant on every partial save.
const update = {
  ...idParam,
  body: z
    .object(mutableFields)
    .partial()
    .superRefine((data, ctx) => {
      if (data.endAt && data.startAt && data.endAt < data.startAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'End must be on or after start' });
      }
    }),
};

const getOrDelete = { ...idParam };

const createSubtask = {
  ...idParam,
  body: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    assignedEmployees: z.array(z.string().min(1)).min(1, 'At least one assignee is required'),
    resourcesRequired: z.array(resourceRequiredSchema).optional(),
    contactsRequired: z.array(contactRequiredSchema).optional(),
    followUps: z.array(followUpSchema).optional(),
    reviewMandatory: z.boolean().optional(),
  }),
};

const addFollowUp = { ...idParam, body: followUpSchema };

const toggleFollowUp = {
  params: z.object({ id: z.string().min(1), followUpId: z.string().min(1) }),
  body: z.object({ isDone: z.boolean() }),
};

const listMine = {
  query: z.object({
    type: typeEnum.optional(),
  }),
};

// Client/team/employee/date — any combination, all optional, all
// combinable at once on the admin unified task view.
const adminFilter = {
  query: z.object({
    clientId: z.string().min(1).optional(),
    teamId: z.string().min(1).optional(),
    employeeId: z.string().min(1).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
};

// Sends a for_review task back to pending — every field optional, since
// admin/leader may just reject with a note and no edits at all.
const reject = {
  ...idParam,
  body: z
    .object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().optional(),
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
      note: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.endAt && data.startAt && data.endAt < data.startAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'End must be on or after start' });
      }
    }),
};

// A fresh task linked back to the just-completed one — type/team/client/
// event/parentTask are inherited server-side (see
// employeeTask.service.js#createContinuation), only the work-defining
// fields are editable here.
const createContinuation = {
  ...idParam,
  body: z
    .object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().optional(),
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
      assignedEmployees: z.array(z.string().min(1)).optional(),
      extraMembers: z.array(z.string().min(1)).optional(),
      reviewMandatory: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.endAt < data.startAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endAt'], message: 'End must be on or after start' });
      }
    }),
};

module.exports = {
  create,
  update,
  getOrDelete,
  createSubtask,
  addFollowUp,
  toggleFollowUp,
  listMine,
  adminFilter,
  reject,
  createContinuation,
  momPipelineDecision,
  momPipelineReject,
};
