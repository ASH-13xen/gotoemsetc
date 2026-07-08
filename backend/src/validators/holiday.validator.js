const { z } = require('zod');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const list = {
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
};

const create = {
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    label: z.string().min(1),
  }),
};

const remove = { ...idParam };

module.exports = { list, create, remove };
