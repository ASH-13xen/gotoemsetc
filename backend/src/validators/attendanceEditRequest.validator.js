const { z } = require('zod');
const { ATTENDANCE_STATUS, ATTENDANCE_EDIT_REQUEST_STATUS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const create = {
  body: z
    .object({
      employeeId: objectId,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
      status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
      overtimeMinutes: z.coerce.number().min(0).optional(),
      isLate: z.boolean().optional(),
      earlyDeparture: z.boolean().optional(),
      paidLeaveAwarded: z.boolean().optional(),
      reason: z.string().trim().min(1, 'Give a reason for the change').max(1000),
    })
    .refine(
      (d) => d.status !== undefined || d.overtimeMinutes !== undefined || d.isLate !== undefined || d.earlyDeparture !== undefined,
      { message: 'Choose a status, overtime, late or early-departure change' }
    ),
};

const list = {
  query: z.object({
    status: z.enum(Object.values(ATTENDANCE_EDIT_REQUEST_STATUS)).optional(),
    employeeId: objectId.optional(),
  }),
};

const decide = {
  params: z.object({ id: objectId }),
  body: z.object({ note: z.string().trim().max(500).optional() }),
};

module.exports = { create, list, decide };
