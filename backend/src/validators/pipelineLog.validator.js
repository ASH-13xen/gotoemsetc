const { z } = require('zod');
const { TASK_STAGE } = require('../config/constants');

const stageEnum = z.enum(Object.values(TASK_STAGE));

const list = {
  query: z.object({ client: z.string().min(1) }),
};

const create = {
  body: z.object({
    client: z.string().min(1),
    stage: stageEnum,
    customLabel: z.string().optional(),
    note: z.string().min(1),
  }),
};

module.exports = { list, create };
