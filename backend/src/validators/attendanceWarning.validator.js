const { z } = require('zod');
const { ATTENDANCE_WARNING_CATEGORY } = require('../config/constants');

const categoryEnum = z.enum(Object.values(ATTENDANCE_WARNING_CATEGORY));

const dailyReport = {
  query: z.object({
    date: z.string().min(1).optional(), // 'YYYY-MM-DD' override; defaults to previous working day
  }),
};

const send = {
  body: z.object({
    employeeId: z.string().min(1),
    date: z.string().min(1),
    category: categoryEnum,
    message: z.string().trim().min(1),
  }),
};

const monthly = {
  params: z.object({ employeeId: z.string().min(1) }),
  query: z.object({
    year: z.coerce.number().int(),
    month: z.coerce.number().int().min(1).max(12),
  }),
};

module.exports = { dailyReport, send, monthly };
