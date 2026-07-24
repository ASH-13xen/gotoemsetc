const { z } = require('zod');
const { COMPANY_EVENT_TYPE } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };

const list = {
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
  }),
};

const create = {
  body: z.object({
    type: z.enum(Object.values(COMPANY_EVENT_TYPE)),
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    notes: z.string().optional(),
  }),
};

const remove = { ...idParam };

module.exports = { list, create, remove };
