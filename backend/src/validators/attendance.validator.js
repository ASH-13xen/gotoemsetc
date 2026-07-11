const { z } = require('zod');
const { ATTENDANCE_STATUS } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const mark = {
  params: idParam,
  body: z
    .object({
      date: dateStringSchema,
      status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
      overtimeHours: z.coerce.number().min(0).optional(),
      notes: z.string().optional(),
    })
    .refine((data) => data.status !== undefined || data.overtimeHours !== undefined, {
      message: 'At least one of status or overtimeHours is required',
    }),
};

const listForEmployee = {
  params: idParam,
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
};

const getSummary = { params: idParam };

module.exports = { mark, listForEmployee, getSummary };
