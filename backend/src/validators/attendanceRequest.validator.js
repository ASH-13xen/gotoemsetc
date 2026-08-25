const { z } = require('zod');
const { ATTENDANCE_STATUS, ATTENDANCE_REQUEST_STATUS, LEAVE_APPLICATION_STATUSES } = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const create = {
  body: z.object({
    date: dateStringSchema,
    // Inclusive end of a multi-day span — only ever sent by the structured
    // "apply for leave" flow (frontendall); the free-text flow omits it, and
    // the service treats a missing endDate as a single-day request (endDate
    // === date).
    endDate: dateStringSchema.optional(),
    reason: z.string().min(1, 'Please describe what needs to change'),
    // Only ever sent by the structured "apply for leave" flow — the
    // free-text flow omits it entirely. Mutually exclusive with
    // requestedEarlyDeparture in practice (the frontend Type dropdown only
    // ever sends one), but nothing here enforces that — both being present
    // is harmless, requestedStatus just also gets stored alongside the flag.
    requestedStatus: z.enum(LEAVE_APPLICATION_STATUSES).optional(),
    requestedEarlyDeparture: z.boolean().optional(),
  }),
};

const cmApprove = { params: idParam.params };

const list = {
  query: z.object({
    status: z.enum(Object.values(ATTENDANCE_REQUEST_STATUS)).optional(),
  }),
};

const paidLeaveEligibility = {
  query: z.object({
    date: dateStringSchema.optional(),
  }),
};

const resolve = {
  params: idParam.params,
  body: z.object({
    status: z.enum(Object.values(ATTENDANCE_STATUS)).optional(),
    overtimeMinutes: z.coerce.number().min(0).optional(),
    isLate: z.coerce.boolean().optional(),
    earlyDeparture: z.coerce.boolean().optional(),
  }),
};

const reject = {
  params: idParam.params,
  body: z.object({
    reason: z.string().optional(),
  }),
};

const revoke = {
  params: idParam.params,
};

const acknowledge = {
  params: idParam.params,
};

module.exports = { create, list, resolve, reject, revoke, acknowledge, paidLeaveEligibility, cmApprove };
