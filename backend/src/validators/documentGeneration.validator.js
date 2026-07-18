const { z } = require('zod');

const idParam = z.object({ id: z.string().min(1) });

const generate = {
  params: idParam,
  body: z.object({
    templateIds: z.array(z.string().min(1)).min(1),
    overrides: z.record(z.string(), z.any()).optional(),
  }),
};

const listForEmployee = { params: idParam };
const getOrDelete = { params: idParam };

const uploadSigned = {
  params: z.object({ id: z.string().min(1), docId: z.string().min(1) }),
};

module.exports = { generate, listForEmployee, getOrDelete, uploadSigned };
