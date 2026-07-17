const { z } = require('zod');
const { ATTENDANCE_STATUS, ATTENDANCE_REQUEST_STATUS } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const create = {
  body: z.object({
    date: dateStringSchema,
    reason: z.string().min(1, 'Please describe what needs to change'),
  }),
};

const list = {
  query: z.object({
    status: z.enum(Object.values(ATTENDANCE_REQUEST_STATUS)).optional(),
  }),
};

const resolve = {
  params: idParam.params,
  body: z.object({
    status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
    overtimeHours: z.coerce.number().min(0).optional(),
    isLate: z.coerce.boolean().optional(),
    earlyDeparture: z.coerce.boolean().optional(),
  }),
};

module.exports = { create, list, resolve };
