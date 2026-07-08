const { z } = require('zod');
const { TASK_STAGE, TASK_STATUS, TASK_PRIORITY } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });
const attachmentParam = z.object({ id: z.string().min(1), attachmentId: z.string().min(1) });

const stageEnum = z.enum(Object.values(TASK_STAGE));
const statusEnum = z.enum(Object.values(TASK_STATUS));
const priorityEnum = z.enum(Object.values(TASK_PRIORITY));

const create = {
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    client: z.string().min(1),
    stage: stageEnum.optional(),
    customLabel: z.string().optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    dueDate: z.coerce.date().optional(),
    assigneeEmployees: z.array(z.string().min(1)).optional(),
    assigneeTeam: z.string().min(1).optional(),
  }),
};

const update = {
  params: idParam,
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    stage: stageEnum.optional(),
    customLabel: z.string().optional(),
    priority: priorityEnum.optional(),
    dueDate: z.coerce.date().optional(),
    assigneeEmployees: z.array(z.string().min(1)).optional(),
    assigneeTeam: z.string().min(1).optional(),
  }),
};

const updateStatus = {
  params: idParam,
  body: z.object({
    status: statusEnum,
    // Required by the service when status is 'done', optional otherwise.
    summary: z.string().optional(),
  }),
};

const getOrDelete = { params: idParam };

const list = {
  query: z.object({
    client: z.string().optional(),
    stage: stageEnum.optional(),
    status: statusEnum.optional(),
    assignee: z.string().optional(),
    priority: priorityEnum.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
};

const comment = {
  params: idParam,
  body: z.object({ body: z.string().min(1) }),
};

const removeAttachment = { params: attachmentParam };

module.exports = { create, update, updateStatus, getOrDelete, list, comment, removeAttachment };
