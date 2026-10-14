const { z } = require('zod');
const { REIMBURSEMENT_CATEGORY, REIMBURSEMENT_TRAVEL_MODE } = require('../config/constants');

const idParam = z.object({ id: z.string().min(1) });

const file = {
  body: z.object({
    category: z.enum(Object.values(REIMBURSEMENT_CATEGORY)),
    travelMode: z.enum(Object.values(REIMBURSEMENT_TRAVEL_MODE)).optional(),
    client: z.string().min(1).optional(),
    clientBrandName: z.string().trim().max(200).optional(),
    expenseDate: z.string().min(1),
    description: z.string().min(1),
    // Sent as multipart (the receipt rides along), where a list arrives as
    // one value, several, or a JSON string.
    peopleInvolved: z.preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim().startsWith('[')) {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return [v];
    }, z.array(z.string().min(1)).optional()),
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

const acknowledge = { params: idParam };

module.exports = { file, list, reject, markPaid, acknowledge, idParam };
