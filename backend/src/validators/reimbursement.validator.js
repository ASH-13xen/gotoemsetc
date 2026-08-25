const { z } = require('zod');
const { REIMBURSEMENT_CATEGORY, REIMBURSEMENT_TRAVEL_MODE } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

const file = {
  body: z.object({
    category: z.enum(Object.values(REIMBURSEMENT_CATEGORY)),
    travelMode: z.enum(Object.values(REIMBURSEMENT_TRAVEL_MODE)).optional(),
    client: z.string().min(1).optional(),
    clientBrandName: z.string().min(1).optional(),
    expenseDate: z.string().min(1),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    description: z.string().min(1),
    peopleInvolved: z.array(z.string().min(1)).optional(),
    amount: z.coerce.number().positive(),
  }),
};

const list = { query: z.object({ status: z.string().optional() }) };

const reject = {
  params: idParam,
  body: z.object({ reason: z.string().min(1) }),
};

const markPaid = {
  params: idParam,
  body: z.object({
    mode: z.string().min(1).optional(),
    referenceNumber: z.string().min(1).optional(),
    paidOn: z.string().optional(),
    note: z.string().optional(),
  }),
};

module.exports = { file, list, reject, markPaid, idParam };
