const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// A day has 1440 minutes; nobody works more overtime than that.
const minutes = z.coerce.number().int('Whole minutes only').min(1, 'Enter the overtime minutes').max(1440);
const idParam = z.object({ id: objectId });

const apply = {
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    minutes,
    reason: z.string().trim().min(1, 'Say what the overtime was for').max(1000),
  }),
};

const cmApprove = {
  params: idParam,
  body: z.object({
    minutes,
    reason: z.string().trim().min(1, 'Give HR the reason for this overtime').max(1000),
  }),
};

const approve = {
  params: idParam,
  body: z.object({ minutes: minutes.optional(), note: z.string().trim().max(1000).optional() }),
};

const reject = {
  params: idParam,
  body: z.object({ reason: z.string().trim().min(1, 'Give a reason').max(1000) }),
};

const forEmployee = {
  params: z.object({ employeeId: objectId }),
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(3000).optional(),
  }),
};

module.exports = { apply, cmApprove, approve, reject, forEmployee };
