const { z } = require('zod');
const {
  ATTENDANCE_STATUS,
  ATTENDANCE_REQUEST_STATUS,
  LEAVE_APPLICATION_STATUSES,
  ATTENDANCE_REQUEST_HALF_DAY_PERIOD,
} = require('../config/constants');

const idParam = { params: z.object({ id: z.string().min(1) }) };
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Only Work From Home may span multiple days — Short Leave, Late, Half Day
// and a plain Paid Leave are each a single-day ask, and Early Departure
// (independent of requestedStatus) is as well. Checked here rather than
// left to the service so a mismatched endDate is rejected before any
// eligibility/routing logic runs.
const SINGLE_DAY_ONLY_STATUSES = ['SL', 'L', 'H', 'O'];

const create = {
  body: z
    .object({
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
      // The "Multiple Days" type — a general, uncapped multi-day leave
      // request with no specific requestedStatus. See
      // AttendanceModificationRequest.js.
      requestedMultiDayLeave: z.boolean().optional(),
      // Required only when requestedStatus is 'H' — see below.
      requestedHalfDayPeriod: z.enum(Object.values(ATTENDANCE_REQUEST_HALF_DAY_PERIOD)).optional(),
    })
    .refine((body) => body.requestedStatus !== 'H' || Boolean(body.requestedHalfDayPeriod), {
      message: 'Choose which half of the day',
      path: ['requestedHalfDayPeriod'],
    })
    .refine(
      (body) =>
        !SINGLE_DAY_ONLY_STATUSES.includes(body.requestedStatus) || !body.endDate || body.endDate === body.date,
      { message: 'This leave type can only be applied for a single day', path: ['endDate'] }
    )
    .refine(
      (body) =>
        body.requestedStatus === 'W' ||
        body.requestedMultiDayLeave ||
        !body.requestedEarlyDeparture ||
        !body.endDate ||
        body.endDate === body.date,
      { message: 'Early departure can only be applied for a single day', path: ['endDate'] }
    ),
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

const monthlyCounts = paidLeaveEligibility;

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

module.exports = { create, list, resolve, reject, revoke, acknowledge, paidLeaveEligibility, monthlyCounts, cmApprove };
